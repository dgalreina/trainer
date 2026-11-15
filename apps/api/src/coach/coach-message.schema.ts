import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/**
 * Un mensaje de la conversación con el entrenador (del usuario o de la IA). Son datos de salud: solo los ve su dueño,
 * se pueden borrar desde la app y se recortan a los últimos `COACH_MAX_STORED_MESSAGES`.
 */
@Schema({ collection: "coach_messages" })
export class CoachMessageDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, enum: ["user", "assistant"], required: true })
  role!: "user" | "assistant";

  @Prop({ type: String, required: true })
  content!: string;

  /** La respuesta se apoyó en datos consultados con herramientas (esas consultas no se guardan, solo este aviso). */
  @Prop({ type: Boolean, default: false })
  usedTools?: boolean;

  /** La propuesta de entrenamiento que acompaña a esta respuesta (la tarjeta del chat). */
  @Prop({ type: String, default: null })
  proposalId?: string | null;

  // Se pone a mano (no con `timestamps`): el mensaje del usuario y la respuesta se guardan a la vez y deben quedar en orden.
  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type CoachMessageDocument = HydratedDocument<CoachMessageDoc>;
export const CoachMessageSchema = SchemaFactory.createForClass(CoachMessageDoc);

// Siempre se consulta «mi conversación, por orden».
CoachMessageSchema.index({ userId: 1, createdAt: -1 });
