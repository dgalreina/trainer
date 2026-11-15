import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { ProposalStatus, TrainingProposalPayload } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

/** Un entrenamiento que el entrenador ha propuesto en el chat. No existe como entrenamiento hasta que el usuario lo acepta. */
@Schema({ timestamps: true, collection: "coach_proposals" })
export class CoachProposalDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, enum: ["pending", "accepted", "rejected"], default: "pending" })
  status!: ProposalStatus;

  /** Ya traducido al formato de la app y validado con los esquemas de `@trainer/shared`. */
  @Prop({ type: Object, required: true })
  training!: TrainingProposalPayload;

  /** El entrenamiento creado al aceptar. */
  @Prop({ type: String, default: null })
  trainingId?: string | null;

  createdAt!: Date;
}

export type CoachProposalDocument = HydratedDocument<CoachProposalDoc>;
export const CoachProposalSchema = SchemaFactory.createForClass(CoachProposalDoc);
CoachProposalSchema.index({ userId: 1, createdAt: -1 });
