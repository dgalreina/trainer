import type Anthropic from "@anthropic-ai/sdk";
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AiPlan, CoachJob, CoachMessage, CoachStoredMessage, CoachUsage } from "@trainer/shared";
import { RateLimitError } from "@anthropic-ai/sdk";
import type { AuthUser } from "../auth/current-user.decorator.js";
import { SettingsService } from "../settings/settings.service.js";
import { anthropic, MODEL } from "./anthropic.js";
import { CoachContextService } from "./coach-context.service.js";
import { CoachConversationService } from "./coach-conversation.service.js";
import { CoachJobsService } from "./coach-jobs.service.js";
import { CoachUsageService, estimateCostEur, monthKey } from "./coach-usage.service.js";
import { CoachProposalsService } from "./proposals/coach-proposals.service.js";
import { CoachToolsService } from "./tools/coach-tools.service.js";
import { TOOLS } from "./tools/definitions.js";
import { MONTHLY_TOKEN_CAP } from "./plans.js";
import { SYSTEM_PROMPT, cardPrompt } from "./prompts/index.js";

/**
 * Tope de tokens de cada respuesta: acota lo que puede costar una sola llamada. Incluye los tokens de pensamiento (con
 * 600 se llegó a gastar todo pensando tras una consulta y la respuesta salió vacía) y el diseño de un entrenamiento,
 * que es largo (varios días con todas sus series).
 */
const MAX_TOKENS = 6000;
/** Cuántas vueltas de «Claude pide una herramienta → la ejecutamos» se permiten por mensaje. Cada vuelta es una llamada que cuesta. */
const MAX_TOOL_TURNS = 6;
/** Cuánta conversación se reenvía a Claude en cada llamada (en tokens estimados). La API no tiene memoria: se manda el historial. */
const HISTORY_TOKEN_BUDGET = 6000;

/** Estimación gruesa (~4 caracteres por token en español); basta para recortar el historial. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/** Los mensajes más recientes que caben en el presupuesto. Siempre se conserva el último (el del usuario). */
export function trimHistory(messages: CoachMessage[], budget = HISTORY_TOKEN_BUDGET): CoachMessage[] {
  const kept: CoachMessage[] = [];
  let tokens = 0;
  for (const message of [...messages].reverse()) {
    tokens += estimateTokens(message.content);
    if (tokens > budget && kept.length > 0) break;
    kept.unshift(message);
  }
  // La conversación que se envía debe empezar por un mensaje del usuario.
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}

/** El error de una llamada, como lo ve la app: un mensaje listo para enseñar y, a veces, un código. */
function describeError(error: unknown): { message: string; code?: string } {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === "object" && body !== null) {
      const { message, code } = body as { message?: string; code?: string };
      return { message: message ?? error.message, code };
    }
    return { message: error.message };
  }
  return { message: "No he podido responder ahora mismo. Inténtalo de nuevo." };
}

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly context: CoachContextService,
    private readonly conversation: CoachConversationService,
    private readonly jobs: CoachJobsService,
    private readonly proposals: CoachProposalsService,
    private readonly tools: CoachToolsService,
    private readonly usage: CoachUsageService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * El usuario dice `text`. Se comprueba el plan y el tope, se crea un «trabajo» y se contesta EN SEGUNDO PLANO: una
   * respuesta con herramientas o un entrenamiento tarda más de lo que aguanta el API Gateway (30 s). La app recibe el
   * `jobId` y pregunta por él hasta que está. El servidor es de arranque continuo (Fargate), así que el trabajo sigue
   * aunque la app cierre; la respuesta se guarda igualmente en la conversación.
   */
  async startChat(user: AuthUser, text: string): Promise<{ jobId: string }> {
    await this.assertQuota(user);
    await this.jobs.expireStale(user.userId);
    let job;
    try {
      job = await this.jobs.create(user.userId);
    } catch (error) {
      // El índice único de la base de datos rechaza un segundo mensaje en marcha del mismo usuario.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException({ code: "coach_busy", message: "Todavía estoy contestando tu mensaje anterior." });
      }
      throw error;
    }
    void this.runJob(job.id, user, text);
    return { jobId: job.id };
  }

  private async runJob(jobId: string, user: AuthUser, text: string): Promise<void> {
    try {
      const { reply, proposalId } = await this.chat(user, text);
      await this.jobs.complete(jobId, reply, proposalId);
    } catch (error) {
      const { message, code } = describeError(error);
      if (!(error instanceof HttpException)) {
        this.logger.error(`El mensaje falló: ${error instanceof Error ? error.message : String(error)}`);
      }
      await this.jobs.fail(jobId, message, code).catch(() => undefined);
    }
  }

  /** El estado de un mensaje en curso, para que la app lo consulte. */
  async job(userId: string, jobId: string): Promise<CoachJob> {
    const job = await this.jobs.get(userId, jobId);
    if (!job) throw new NotFoundException("Mensaje no encontrado");
    if (job.status === "error") {
      return { status: "error", error: { message: job.errorMessage ?? "No he podido responder.", code: job.errorCode ?? undefined } };
    }
    if (job.status === "running") return { status: "running" };
    const proposal = job.proposalId ? (await this.proposals.views(userId, [job.proposalId])).get(job.proposalId) : undefined;
    return { status: "done", reply: job.reply ?? "", proposal };
  }

  /** Borra la conversación y las propuestas del usuario. Si hay un mensaje en marcha, no: reaparecería al terminar. */
  async clearConversation(userId: string): Promise<void> {
    if (await this.jobs.findRunning(userId)) {
      throw new ConflictException({ code: "coach_busy", message: "Espera a que termine de contestarte para borrar la conversación." });
    }
    await this.conversation.clear(userId);
    await this.proposals.clearAll(userId);
  }

  /** La conversación guardada, con la tarjeta de propuesta (y su estado actual) en los mensajes que la llevan. */
  async messages(userId: string): Promise<CoachStoredMessage[]> {
    const stored = await this.conversation.list(userId);
    const ids = stored.flatMap((m) => (m.proposalId ? [m.proposalId] : []));
    const views = await this.proposals.views(userId, ids);
    return stored.map(({ proposalId, ...m }) => ({ ...m, ...(proposalId && views.has(proposalId) ? { proposal: views.get(proposalId) } : {}) }));
  }

  /**
   * La vuelta de conversación: la conversación sale de Mongo (no la manda la app) y, si todo va bien, se guarda la vuelta
   * entera. Si Claude necesita un dato concreto, pide una herramienta (`tool_use`): la ejecutamos con los datos del
   * usuario, le devolvemos el resultado y repetimos hasta que responde con texto (o se acaban las vueltas).
   */
  private async chat(user: AuthUser, text: string): Promise<{ reply: string; proposalId: string | null }> {
    const { userId } = user;
    const [card, past] = await Promise.all([this.context.buildCard(userId), this.conversation.history(userId)]);
    // Lo que se manda a Claude. Los pasos con herramientas viven solo aquí, en esta llamada: no se guardan en la conversación.
    const convo: Anthropic.MessageParam[] = trimHistory([...past, { role: "user", content: text }]);

    let reply = "";
    let usedTools = false;
    let proposalId: string | null = null;
    let proposalKind: "training" | "diet" = "training";
    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        // Cada vuelta es una llamada que cuesta: el tope mensual se vuelve a comprobar (la primera ya lo hizo `startChat`).
        if (turn > 0) await this.assertQuota(user);
        const response = await this.ask(userId, card, convo, turn === MAX_TOOL_TURNS - 1);
        if (response.stop_reason !== "tool_use") {
          reply = this.replyFrom(response);
          break;
        }

        usedTools = true;
        // Claude pide una o varias herramientas. Se ejecutan una tras otra (nunca en paralelo: una propuesta cuesta una
        // traducción) y todos los resultados vuelven en UN solo mensaje.
        convo.push({ role: "assistant", content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          let content: unknown;
          if ((block.name === "proposeTraining" || block.name === "proposeDiet") && proposalId) {
            // Solo una propuesta por mensaje: la segunda no se prepara.
            content = { error: "Ya has hecho una propuesta en este mensaje. Si hay que cambiarla, el usuario lo pedirá." };
          } else {
            const outcome = await this.tools.run(userId, block.name, block.input);
            if (outcome.proposalId) {
              proposalId = outcome.proposalId;
              proposalKind = outcome.proposalKind ?? "training";
            }
            content = outcome.content;
          }
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(content) });
        }
        convo.push({ role: "user", content: results });
      }
    } catch (error) {
      // Si ya se había preparado una propuesta, no se pierde (ni su coste): se guarda con un texto fijo.
      if (!proposalId) throw error;
      this.logger.warn(`La respuesta falló tras preparar una propuesta: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!reply && proposalId) {
      reply =
        proposalKind === "diet"
          ? "Te he preparado la dieta. Debajo tienes la tarjeta para guardarla o pedirme cambios."
          : "Te he preparado el entrenamiento. Debajo tienes la tarjeta para guardarlo o pedirme cambios.";
    }
    // Una respuesta vacía no se guarda: ensuciaría la conversación y el siguiente mensaje partiría de ella.
    if (!reply) throw new ServiceUnavailableException("No he podido terminar la consulta. Inténtalo de nuevo.");

    await this.conversation.appendExchange(userId, text, reply, usedTools, proposalId);
    return { reply, proposalId };
  }

  /** Una llamada a Claude: la ficha en el `system`, la conversación y las herramientas. Siempre se contabilizan los tokens. */
  private async ask(
    userId: string,
    card: string,
    convo: Anthropic.MessageParam[],
    lastTurn: boolean,
  ): Promise<Anthropic.Message> {
    let response: Anthropic.Message;
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Un chat no necesita razonar a fondo: sin pensamiento extra y esfuerzo bajo (más rápido y barato). Los tokens
        // de pensamiento cuentan contra max_tokens, así que dejarlos activos podría gastar la respuesta entera.
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        system: [
          // Parte estable (se puede cachear: cambia solo cuando se edita el prompt)...
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          // ...y la ficha, que cambia con los datos del usuario, después.
          { type: "text", text: cardPrompt(card) },
        ],
        tools: TOOLS,
        // En la última vuelta ya no se permiten más herramientas: tiene que contestar con lo que tenga.
        ...(lastTurn ? { tool_choice: { type: "none" as const } } : {}),
        messages: convo,
      });
    } catch (error) {
      this.logger.error(`Anthropic falló: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof RateLimitError) {
        throw new HttpException(
          "El entrenador está muy solicitado. Prueba de nuevo en un momento.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ServiceUnavailableException("El entrenador no está disponible ahora mismo.");
    }

    // Control de coste: cada llamada (también cada vuelta con herramientas) guarda quién gastó cuántos tokens.
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
    return response;
  }

  /** El texto de una respuesta que ya no pide herramientas. */
  private replyFrom(response: Anthropic.Message): string {
    if (response.stop_reason === "refusal") {
      return "Eso no te lo puedo responder. Pregúntame lo que quieras sobre tu entreno, tu dieta o tu progreso.";
    }
    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    // Sin texto (todo el tope se fue pensando): se devuelve vacío y `chat` avisa sin guardarlo.
    if (!answer) return "";
    // Si se cortó por el tope de tokens, que no acabe a media palabra sin avisar.
    return response.stop_reason === "max_tokens" ? `${answer}…` : answer;
  }

  /** Lo que ha gastado el usuario este mes, frente a su tope. */
  async monthUsage(user: AuthUser): Promise<CoachUsage> {
    const month = monthKey(new Date());
    const [totals, plan] = await Promise.all([this.usage.month(user.userId, month), this.planOf(user)]);
    const inputTokens = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
    return {
      month,
      plan,
      isAdmin: user.isAdmin,
      calls: totals.calls,
      inputTokens,
      outputTokens: totals.outputTokens,
      totalTokens: inputTokens + totals.outputTokens,
      capTokens: MONTHLY_TOKEN_CAP[plan],
      costEur: estimateCostEur(totals),
    };
  }

  /** El plan que rige: los administradores siempre `pro`; el resto, el que tengan guardado. */
  private planOf(user: AuthUser): Promise<AiPlan> | AiPlan {
    return user.isAdmin ? "pro" : this.settings.aiPlan(user.userId);
  }

  // Se comprueba ANTES de llamar: el último mensaje puede pasarse un poco del tope (no se sabe lo que costará hasta que responde).
  private async assertQuota(user: AuthUser): Promise<void> {
    const usage = await this.monthUsage(user);
    if (usage.capTokens === 0) {
      throw new HttpException(
        { code: "ai_not_included", message: "Tu plan no incluye el entrenador de IA." },
        HttpStatus.FORBIDDEN,
      );
    }
    if (usage.totalTokens >= usage.capTokens) {
      throw new HttpException(
        { code: "ai_quota_exceeded", message: "Has llegado al límite de este mes. Se renueva el día 1." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
