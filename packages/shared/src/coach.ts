import { z } from "zod";

/** Plan de IA del usuario. `gratis` no puede hablar con el entrenador; `prueba` y `pro` sí, con distinto tope. */
export const AI_PLANS = ["gratis", "prueba", "pro"] as const;
export type AiPlan = (typeof AI_PLANS)[number];

/** Un mensaje de la conversación con el entrenador. */
export const coachMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
export type CoachMessage = z.infer<typeof coachMessageSchema>;

/**
 * Lo que manda la app: solo el mensaje nuevo. La conversación la guarda el servidor (así sigue ahí al reabrir la app o
 * al entrar desde otro dispositivo) y es él quien decide qué parte de ella lee Claude.
 */
export const coachSendSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});
export type CoachSend = z.infer<typeof coachSendSchema>;

/** Un mensaje de la conversación guardada. */
export interface CoachStoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** ISO 8601. */
  createdAt: string;
}

/** Cuántos mensajes se guardan por usuario; al pasarse, se van borrando los más antiguos. */
export const COACH_MAX_STORED_MESSAGES = 100;

export interface CoachReply {
  reply: string;
}

/** Cuánta IA ha usado el usuario en un mes (tokens y coste estimado, calculado por el servidor). */
export interface CoachUsage {
  /** Mes consultado, "AAAA-MM". */
  month: string;
  plan: AiPlan;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Tokens contados contra el tope: entrada + salida. */
  totalTokens: number;
  /** Tope mensual de tokens según el plan (0 = sin acceso). */
  capTokens: number;
  /** Coste estimado en euros. Orientativo: el real sale de la factura de Anthropic. */
  costEur: number;
}
