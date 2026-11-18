import { z } from "zod";

/**
 * Análisis de un entreno recién terminado: el entrenador comenta cómo ha ido (`comment`, que también queda en la
 * conversación) y, si lo ve oportuno, deja hasta 3 mejoras para la próxima vez que se haga esa misma rutina. Las mejoras
 * son solo texto: el usuario las cumple o no, nada cambia solo.
 */

/** Cuántas mejoras como máximo deja el entrenador tras un entreno. */
export const COACH_REVIEW_MAX_SUGGESTIONS = 3;

/** Una mejora: `open` mientras el usuario no haga nada; `done` si la ha cumplido; `dismissed` si la descarta. */
export const REVIEW_SUGGESTION_STATUSES = ["open", "done", "dismissed"] as const;
export type ReviewSuggestionStatus = (typeof REVIEW_SUGGESTION_STATUSES)[number];

export interface CoachReviewSuggestion {
  id: string;
  text: string;
  status: ReviewSuggestionStatus;
}

/** Lo que se enseña arriba al empezar el siguiente entreno de la misma rutina. */
export interface CoachReview {
  id: string;
  sessionId: string;
  routineId: string;
  /** ISO 8601. */
  createdAt: string;
  suggestions: CoachReviewSuggestion[];
}

/** La app pide analizar un entreno ya guardado. */
export const startReviewSchema = z.object({ sessionId: z.string().trim().min(1).max(64) });
export type StartReview = z.infer<typeof startReviewSchema>;

export interface CoachReviewStarted {
  reviewId: string;
}

/** Como el chat, el análisis es asíncrono: la app pregunta por él hasta que está. */
export interface CoachReviewJob {
  status: "running" | "done" | "error";
  /** Frase corta para el bocadillo junto al icono («Hola Diego, he visto tu entreno de Brazo…»). */
  headline?: string;
  /** El mensaje completo que ya está en la conversación. */
  message?: string;
}

/** El usuario marca una mejora como cumplida o la descarta. */
export const updateSuggestionSchema = z.object({ status: z.enum(["done", "dismissed"]) });
export type UpdateSuggestion = z.infer<typeof updateSuggestionSchema>;
