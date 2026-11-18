import type Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  COACH_REVIEW_MAX_SUGGESTIONS,
  TECHNIQUE_LABELS,
  type CoachReview,
  type CoachReviewJob,
  type CoachReviewStarted,
  type ReviewSuggestionStatus,
  type WorkoutSession,
} from "@trainer/shared";
import { randomUUID } from "node:crypto";
import { isValidObjectId, type Model } from "mongoose";
import { z } from "zod";
import type { AuthUser } from "../../auth/current-user.decorator.js";
import { ExercisesService } from "../../exercises/exercises.service.js";
import { SessionsService } from "../../sessions/sessions.service.js";
import { TrainingsService } from "../../trainings/trainings.service.js";
import { anthropic, MODEL } from "../anthropic.js";
import { CoachContextService } from "../coach-context.service.js";
import { CoachConversationService } from "../coach-conversation.service.js";
import { CoachUsageService } from "../coach-usage.service.js";
import { CoachService } from "../coach.service.js";
import { REVIEW_PROMPT, SYSTEM_PROMPT, cardPrompt } from "../prompts/index.js";
import { CoachReviewDoc, type CoachReviewDocument } from "./coach-review.schema.js";

/** Un análisis es una sola llamada con poco texto; el tope incluye los tokens de pensamiento. */
const REVIEW_MAX_TOKENS = 2000;
/** Cuántas veces anteriores de la misma rutina se le pasan al entrenador, serie a serie. */
const PREVIOUS_SESSIONS = 3;
/** Un análisis que lleva más de esto «en marcha» se da por perdido (por ejemplo, si se reinició el servidor). */
const REVIEW_STALE_MS = 5 * 60 * 1000;

const EMIT_REVIEW: Anthropic.Tool = {
  name: "emit_review",
  description: "Entrega tu opinión sobre el entreno y las mejoras para la próxima vez.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Frase corta para el bocadillo del icono (máximo 70 caracteres)." },
      comment: { type: "string", description: "Tu opinión en 2-4 frases." },
      suggestions: {
        type: "array",
        maxItems: COACH_REVIEW_MAX_SUGGESTIONS,
        items: { type: "string" },
        description: "De 0 a 3 mejoras concretas para la próxima vez que haga esta rutina.",
      },
    },
    required: ["headline", "comment", "suggestions"],
  },
};

const reviewOutputSchema = z.object({
  headline: z.string().trim().min(1).max(160),
  comment: z.string().trim().min(1).max(1500),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(COACH_REVIEW_MAX_SUGGESTIONS),
});

const kg = (n: number) => String(n).replace(".", ",");

/** Un entreno como lo ve el entrenador: cada ejercicio con sus series (kg × repeticiones) y la nota del usuario. */
function formatSession(session: WorkoutSession, names: Map<string, string>): string {
  const lines = session.entries.map((e) => {
    const technique = e.technique ? ` [${TECHNIQUE_LABELS[e.technique] ?? e.technique}]` : "";
    const sets = e.sets.map((s) => `${kg(s.weightKg)} kg × ${s.reps}`).join(", ");
    const note = e.notes ? ` (nota del usuario: «${e.notes}»)` : "";
    return `- ${names.get(e.exerciseId) ?? "Ejercicio"}${technique}: ${sets}${note}`;
  });
  return lines.join("\n");
}

/** El análisis de cada entreno terminado y las mejoras que deja para el siguiente. */
@Injectable()
export class CoachReviewService {
  private readonly logger = new Logger(CoachReviewService.name);

  constructor(
    @InjectModel(CoachReviewDoc.name) private readonly model: Model<CoachReviewDoc>,
    private readonly coach: CoachService,
    private readonly context: CoachContextService,
    private readonly conversation: CoachConversationService,
    private readonly usage: CoachUsageService,
    private readonly sessions: SessionsService,
    private readonly trainings: TrainingsService,
    private readonly exercises: ExercisesService,
  ) {}

  /**
   * La app avisa de que ha guardado un entreno. Si el plan incluye IA y queda cuota, se analiza en segundo plano (como el
   * chat) y la app pregunta por el resultado. Pedirlo dos veces por el mismo entreno devuelve el mismo análisis.
   */
  async start(user: AuthUser, sessionId: string): Promise<CoachReviewStarted> {
    const session = await this.sessions.get(user.userId, sessionId);
    const existing = await this.model.findOne({ userId: user.userId, sessionId: session.id });
    if (existing) return { reviewId: existing.id };

    await this.coach.assertQuota(user);
    let doc: CoachReviewDocument;
    try {
      doc = await this.model.create({ userId: user.userId, sessionId: session.id, routineId: session.routineId, status: "running" });
    } catch (error) {
      // Dos avisos a la vez: el índice único deja pasar solo uno.
      if ((error as { code?: number }).code === 11000) {
        const other = await this.model.findOne({ userId: user.userId, sessionId: session.id });
        if (other) return { reviewId: other.id };
      }
      throw error;
    }
    void this.run(doc.id, user, session);
    return { reviewId: doc.id };
  }

  private async run(reviewId: string, user: AuthUser, session: WorkoutSession): Promise<void> {
    const { userId } = user;
    try {
      const [card, exercises, training, recent] = await Promise.all([
        this.context.buildCard(userId),
        this.exercises.list(userId),
        session.trainingId ? this.trainings.get(userId, session.trainingId).catch(() => null) : null,
        this.sessions.list(userId, 30),
      ]);
      const names = new Map(exercises.map((e) => [e.id, e.name]));
      const routineIndex = training?.routines.findIndex((r) => r.id === session.routineId) ?? -1;
      const routineName = (routineIndex >= 0 && training?.routines[routineIndex].name) || (routineIndex >= 0 ? `Día ${routineIndex + 1}` : "la rutina");
      const previous = recent.filter((s) => s.routineId === session.routineId && s.id !== session.id && s.date < session.date).slice(0, PREVIOUS_SESSIONS);

      const parts = [
        `Entreno que acaba de terminar: «${routineName}»${training ? ` (del entrenamiento «${training.name}»)` : ""}, ${session.date.slice(0, 10)}` +
          (session.durationSeconds ? `, ${Math.round(session.durationSeconds / 60)} min` : "") +
          `.\n${formatSession(session, names)}`,
        previous.length === 0
          ? "Es la primera vez que hace esta rutina: no hay con qué compararla."
          : `Las últimas veces que hizo esta rutina (de la más reciente a la más antigua):\n` +
            previous.map((s) => `${s.date.slice(0, 10)}:\n${formatSession(s, names)}`).join("\n\n"),
      ];

      const response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: REVIEW_MAX_TOKENS,
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: cardPrompt(card) },
          { type: "text", text: REVIEW_PROMPT },
        ],
        tools: [EMIT_REVIEW],
        messages: [{ role: "user", content: parts.join("\n\n") }],
      });
      // Control de coste: cada llamada guarda quién gastó cuántos tokens.
      await this.usage.record(
        userId,
        MODEL,
        {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
        },
        response.stop_reason,
      );

      const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_review");
      const output = reviewOutputSchema.parse(block?.input);

      // El comentario queda también en la conversación: así se puede contestar al entrenador desde el chat.
      const message =
        output.comment +
        (output.suggestions.length > 0 ? `\n\nPara la próxima vez:\n${output.suggestions.map((s) => `- ${s}`).join("\n")}` : "");
      await this.conversation.appendCoachMessage(userId, message);
      await this.model.updateOne(
        { _id: reviewId, status: "running" },
        {
          $set: {
            status: "done",
            headline: output.headline,
            message,
            suggestions: output.suggestions.map((text) => ({ id: randomUUID(), text, status: "open" })),
          },
        },
      );
    } catch (error) {
      this.logger.error(`El análisis del entreno falló: ${error instanceof Error ? error.message : String(error)}`);
      await this.model.updateOne({ _id: reviewId, status: "running" }, { $set: { status: "error" } }).catch(() => undefined);
    }
  }

  /** Cómo va un análisis, para que la app lo consulte. */
  async job(userId: string, id: string): Promise<CoachReviewJob> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Análisis no encontrado");
    if (doc.status === "running" && Date.now() - doc.createdAt.getTime() > REVIEW_STALE_MS) return { status: "error" };
    if (doc.status === "done") return { status: "done", headline: doc.headline ?? undefined, message: doc.message ?? undefined };
    return { status: doc.status };
  }

  /** Las mejoras pendientes del último entreno de esta rutina (solo las que el usuario no ha cumplido ni descartado). */
  async pending(userId: string, routineId: string): Promise<CoachReview | null> {
    const doc = await this.model.findOne({ userId, routineId, status: "done" }).sort({ createdAt: -1 });
    if (!doc) return null;
    const open = doc.suggestions.filter((s) => s.status === "open");
    if (open.length === 0) return null;
    return {
      id: doc.id,
      sessionId: doc.sessionId,
      routineId: doc.routineId,
      createdAt: doc.createdAt.toISOString(),
      suggestions: open.map((s) => ({ id: s.id, text: s.text, status: s.status })),
    };
  }

  /** El usuario cumple o descarta una mejora. */
  async setSuggestion(userId: string, id: string, suggestionId: string, status: ReviewSuggestionStatus): Promise<void> {
    if (!isValidObjectId(id)) throw new NotFoundException("Análisis no encontrado");
    const result = await this.model.updateOne({ _id: id, userId, "suggestions.id": suggestionId }, { $set: { "suggestions.$.status": status } });
    if (result.matchedCount === 0) throw new NotFoundException("Mejora no encontrada");
  }

  /** Borra los análisis del usuario (al borrar la conversación). */
  async clearAll(userId: string): Promise<void> {
    await this.model.deleteMany({ userId });
  }
}
