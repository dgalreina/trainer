import { z } from "zod";
import { AI_PLANS, type AiPlan } from "./coach";

/** Un usuario en el panel de administración: quién es y cuánta IA ha gastado este mes. Nunca incluye sus datos de salud ni sus conversaciones. */
export interface AdminUser {
  userId: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  /** Plan efectivo (los administradores siempre `pro`). */
  plan: AiPlan;
  calls: number;
  totalTokens: number;
  capTokens: number;
  /** Coste estimado del mes en euros. */
  costEur: number;
  /** Última llamada a la IA (ISO 8601), si hizo alguna este mes. */
  lastUsedAt: string | null;
  /** Alta en Cognito (ISO 8601). */
  signedUpAt: string | null;
}

export interface AdminOverview {
  /** "AAAA-MM". */
  month: string;
  totals: { users: number; calls: number; totalTokens: number; costEur: number };
  /** De más a menos gasto. */
  users: AdminUser[];
}

export const adminPlanSchema = z.object({ plan: z.enum(AI_PLANS) });
export type AdminPlanUpdate = z.infer<typeof adminPlanSchema>;

/** Algo que la IA quiso hacer y la app no puede representar, agrupado por tipo. No dice quién lo pidió. */
export const SUGGESTION_STATUSES = ["open", "done", "dismissed"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface AppSuggestion {
  id: string;
  /** Tipo estable, por ejemplo `technique_partial_sets` o `tempo`. */
  code: string;
  /** Cuántas veces ha salido. */
  count: number;
  /** Los últimos ejemplos, tal como los describió la IA. */
  examples: string[];
  status: SuggestionStatus;
  /** Última vez que salió (ISO 8601). */
  lastSeenAt: string;
}

export const suggestionStatusSchema = z.object({ status: z.enum(SUGGESTION_STATUSES) });
export type SuggestionStatusUpdate = z.infer<typeof suggestionStatusSchema>;
