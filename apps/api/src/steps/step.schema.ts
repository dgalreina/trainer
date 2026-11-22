import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "step_logs" })
export class StepDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  // Hasta qué momento cuentan los pasos (acumulados desde las 00:00 de ese día).
  @Prop({ type: Date, required: true })
  date!: Date;

  // Día de calendario "AAAA-MM-DD" del usuario: un registro por día.
  @Prop({ type: String, required: true })
  day!: string;

  @Prop({ type: Number, required: true })
  steps!: number;
}

export type StepDocument = HydratedDocument<StepDoc>;
export const StepSchema = SchemaFactory.createForClass(StepDoc);

// Un registro de pasos por usuario y día; también sirve para consultar por rango.
StepSchema.index({ userId: 1, day: 1 }, { unique: true });
StepSchema.index({ userId: 1, date: -1 });
