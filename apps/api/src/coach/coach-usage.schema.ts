import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/** Una llamada a la IA: quién, con qué modelo y cuántos tokens. Es lo que permite ver y limitar el gasto por usuario. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "coach_usage" })
export class CoachUsageDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: Number, required: true })
  inputTokens!: number;

  @Prop({ type: Number, required: true })
  outputTokens!: number;

  @Prop({ type: Number, default: 0 })
  cacheReadTokens!: number;

  @Prop({ type: Number, default: 0 })
  cacheWriteTokens!: number;

  /** Cómo acabó la respuesta: end_turn, max_tokens, refusal... */
  @Prop({ type: String, default: null })
  stopReason!: string | null;

  createdAt!: Date;
}

export type CoachUsageDocument = HydratedDocument<CoachUsageDoc>;
export const CoachUsageSchema = SchemaFactory.createForClass(CoachUsageDoc);

// Siempre se consulta "lo que ha gastado este usuario este mes".
CoachUsageSchema.index({ userId: 1, createdAt: -1 });
