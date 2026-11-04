import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "weights" })
export class WeightDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  // El momento de la pesada, como Date para poder ordenar y consultar por rango.
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Number, required: true })
  weightKg!: number;
}

export type WeightDocument = HydratedDocument<WeightDoc>;
export const WeightSchema = SchemaFactory.createForClass(WeightDoc);

// Siempre se consulta "mis pesadas, por fecha".
WeightSchema.index({ userId: 1, date: -1 });
