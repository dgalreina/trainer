import Anthropic from "@anthropic-ai/sdk";
import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AiPlan, CoachMessage, CoachUsage } from "@trainer/shared";
import type { AuthUser } from "../auth/current-user.decorator.js";
import { SettingsService } from "../settings/settings.service.js";
import { CoachContextService } from "./coach-context.service.js";
import { CoachConversationService } from "./coach-conversation.service.js";
import { CoachUsageService, estimateCostEur, monthKey } from "./coach-usage.service.js";
import { MONTHLY_TOKEN_CAP } from "./plans.js";
import { SYSTEM_PROMPT, cardPrompt } from "./prompts/index.js";

const MODEL = "claude-sonnet-5-5";
/** Tope de tokens de cada respuesta: acota lo que puede costar una sola llamada. */
const MAX_TOKENS = 600;
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

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private client: Anthropic | null = null;

  constructor(
    private readonly context: CoachContextService,
    private readonly conversation: CoachConversationService,
    private readonly usage: CoachUsageService,
    private readonly settings: SettingsService,
  ) {}

  // Se crea la primera vez que hace falta: así la API arranca aunque no haya clave (y el resto de la app funciona).
  private anthropic(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException("El entrenador no está disponible ahora mismo.");
    }
    return (this.client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
  }

  /**
   * El usuario dice `text` y el entrenador contesta. La conversación sale de Mongo (no la manda la app) y, si todo va
   * bien, se guarda la vuelta entera: lo que dijo el usuario y la respuesta.
   */
  async chat(user: AuthUser, text: string): Promise<string> {
    const { userId } = user;
    await this.assertQuota(user);
    const [card, past] = await Promise.all([this.context.buildCard(userId), this.conversation.history(userId)]);
    const messages: CoachMessage[] = [...past, { role: "user", content: text }];

    let response: Anthropic.Message;
    try {
      response = await this.anthropic().messages.create({
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
        messages: trimHistory(messages),
      });
    } catch (error) {
      this.logger.error(`Anthropic falló: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Anthropic.RateLimitError) {
        throw new HttpException(
          "El entrenador está muy solicitado. Prueba de nuevo en un momento.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ServiceUnavailableException("El entrenador no está disponible ahora mismo.");
    }

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

    let reply: string;
    if (response.stop_reason === "refusal") {
      reply = "Eso no te lo puedo responder. Pregúntame lo que quieras sobre tu entreno, tu dieta o tu progreso.";
    } else {
      const answer = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      // Si se cortó por el tope de tokens, que no acabe a media palabra sin avisar.
      reply = response.stop_reason === "max_tokens" ? `${answer}…` : answer;
    }
    await this.conversation.appendExchange(userId, text, reply);
    return reply;
  }

  /** Lo que ha gastado el usuario este mes, frente a su tope. */
  async monthUsage(user: AuthUser): Promise<CoachUsage> {
    const month = monthKey(new Date());
    const [totals, plan] = await Promise.all([this.usage.month(user.userId, month), this.planOf(user)]);
    const inputTokens = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
    return {
      month,
      plan,
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
