import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { CoachJobStatus } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

/**
 * Un mensaje al entrenador que se está trabajando en segundo plano. La app pregunta por él hasta que acaba. Dura un día
 * (índice TTL): la respuesta de verdad queda en `coach_messages`.
 */
@Schema({ timestamps: true, collection: "coach_jobs" })
export class CoachJobDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, enum: ["running", "done", "error"], default: "running" })
  status!: CoachJobStatus;

  @Prop({ type: String, default: null })
  reply!: string | null;

  @Prop({ type: String, default: null })
  proposalId!: string | null;

  @Prop({ type: String, default: null })
  errorMessage!: string | null;

  @Prop({ type: String, default: null })
  errorCode!: string | null;

  createdAt!: Date;
}

export type CoachJobDocument = HydratedDocument<CoachJobDoc>;
export const CoachJobSchema = SchemaFactory.createForClass(CoachJobDoc);
CoachJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
// Un solo mensaje en marcha por usuario, garantizado por la base de datos (dos envíos a la vez no pasan los dos).
CoachJobSchema.index({ userId: 1 }, { name: "one_running_per_user", unique: true, partialFilterExpression: { status: "running" } });
