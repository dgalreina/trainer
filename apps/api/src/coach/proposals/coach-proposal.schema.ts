import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { DietProposalPayload, ProposalStatus, TrainingProposalPayload } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

/** Un entrenamiento o una dieta que el entrenador ha propuesto en el chat. No existe de verdad hasta que el usuario lo acepta. */
@Schema({ timestamps: true, collection: "coach_proposals" })
export class CoachProposalDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, enum: ["pending", "accepted", "rejected"], default: "pending" })
  status!: ProposalStatus;

  /** Qué se propone. Las propuestas de antes de las dietas no lo llevan: son entrenamientos. */
  @Prop({ type: String, enum: ["training", "diet"], default: "training" })
  kind!: "training" | "diet";

  /** Ya traducido al formato de la app y validado con los esquemas de `@trainer/shared` (si es un entrenamiento). */
  @Prop({ type: Object })
  training?: TrainingProposalPayload;

  /** Lo mismo, si es una dieta. */
  @Prop({ type: Object })
  diet?: DietProposalPayload;

  /** La dieta creada al aceptar. */
  @Prop({ type: String, default: null })
  dietId?: string | null;

  /** El entrenamiento creado al aceptar. */
  @Prop({ type: String, default: null })
  trainingId?: string | null;

  createdAt!: Date;
}

export type CoachProposalDocument = HydratedDocument<CoachProposalDoc>;
export const CoachProposalSchema = SchemaFactory.createForClass(CoachProposalDoc);
CoachProposalSchema.index({ userId: 1, createdAt: -1 });
