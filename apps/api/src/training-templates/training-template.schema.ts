import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
class TemplateSetDoc {
  @Prop({ type: Number })
  reps?: number;
}
const TemplateSetSchema = SchemaFactory.createForClass(TemplateSetDoc);

@Schema({ _id: false })
class TemplateSlotDoc {
  // Nombre del ejercicio en el catálogo base.
  @Prop({ type: String, required: true })
  exercise!: string;

  @Prop({ type: [TemplateSetSchema], default: [] })
  sets!: TemplateSetDoc[];

  @Prop({ type: String, enum: ["ss", "rp", "desc"] })
  technique?: string;

  @Prop({ type: Number })
  restSeconds?: number;

  @Prop({ type: String })
  notes?: string;
}
const TemplateSlotSchema = SchemaFactory.createForClass(TemplateSlotDoc);

@Schema({ _id: false })
class TemplateRoutineDoc {
  @Prop({ type: String, default: "" })
  name!: string;

  @Prop({ type: Number, required: true })
  restSeconds!: number;

  @Prop({ type: [TemplateSlotSchema], default: [] })
  slots!: TemplateSlotDoc[];
}
const TemplateRoutineSchema = SchemaFactory.createForClass(TemplateRoutineDoc);

// Compartidas por todos los usuarios y de solo lectura desde la app: se cargan con el seed.
@Schema({ timestamps: true, collection: "training_templates" })
export class TrainingTemplateDoc {
  // Identificador estable (para que el seed pueda repetirse sin duplicar).
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: "" })
  description!: string;

  @Prop({ type: Number, required: true })
  durationWeeks!: number;

  @Prop({ type: [TemplateRoutineSchema], default: [] })
  routines!: TemplateRoutineDoc[];
}

export type TrainingTemplateDocument = HydratedDocument<TrainingTemplateDoc>;
export const TrainingTemplateSchema = SchemaFactory.createForClass(TrainingTemplateDoc);
