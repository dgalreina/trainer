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

/** Lo que manda la app: la conversación hasta ahora. El último mensaje es el del usuario. */
export const coachChatSchema = z.object({
  messages: z
    .array(coachMessageSchema)
    .min(1)
    .max(200)
    .refine((m) => m[m.length - 1].role === "user", "El último mensaje debe ser del usuario"),
});
export type CoachChat = z.infer<typeof coachChatSchema>;

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
