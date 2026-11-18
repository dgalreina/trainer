import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { ReviewSuggestionStatus } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

/** Una mejora que deja el entrenador (solo texto). */
export class ReviewSuggestionDoc {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true })
  text!: string;

  @Prop({ type: String, enum: ["open", "done", "dismissed"], default: "open" })
  status!: ReviewSuggestionStatus;
}

/**
 * El análisis que hace el entrenador de un entreno terminado. Son datos de salud: solo los ve su dueño y se borran
 * con la conversación. Hay uno por entreno (índice único): pedirlo dos veces devuelve el mismo.
 */
@Schema({ timestamps: true, collection: "coach_reviews" })
export class CoachReviewDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  sessionId!: string;

  @Prop({ type: String, required: true })
  routineId!: string;

  @Prop({ type: String, enum: ["running", "done", "error"], default: "running" })
  status!: "running" | "done" | "error";

  /** Frase corta para el bocadillo junto al icono. */
  @Prop({ type: String, default: null })
  headline!: string | null;

  /** El mensaje completo (el mismo que se guarda en la conversación). */
  @Prop({ type: String, default: null })
  message!: string | null;

  @Prop({ type: [{ type: Object }], default: [] })
  suggestions!: ReviewSuggestionDoc[];

  createdAt!: Date;
}

export type CoachReviewDocument = HydratedDocument<CoachReviewDoc>;
export const CoachReviewSchema = SchemaFactory.createForClass(CoachReviewDoc);
CoachReviewSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
// «La última de esta rutina».
CoachReviewSchema.index({ userId: 1, routineId: 1, createdAt: -1 });
