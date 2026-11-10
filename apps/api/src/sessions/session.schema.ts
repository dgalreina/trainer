import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class PerformedSetDoc {
  @Prop({ type: Number, required: true })
  reps!: number;

  @Prop({ type: Number, required: true })
  weightKg!: number;

  @Prop({ type: Number })
  rpe?: number;
}
const PerformedSetSchema = SchemaFactory.createForClass(PerformedSetDoc);

@Schema({ _id: false })
export class SessionEntryDoc {
  @Prop({ type: String, required: true })
  exerciseId!: string;

  @Prop({ type: [PerformedSetSchema], default: [] })
  sets!: PerformedSetDoc[];

  // Técnica especial: "ss" | "rp" | "desc"; sin valor = serie normal.
  @Prop({ type: String, enum: ["ss", "rp", "desc"] })
  technique?: string;

  // Formato antiguo (solo se lee, ya no se escribe): se traduce a `technique`.
  @Prop({ type: Boolean })
  linkedToNext?: boolean;

  @Prop({ type: Boolean })
  restPause?: boolean;

  @Prop({ type: String })
  notes?: string;
}
const SessionEntrySchema = SchemaFactory.createForClass(SessionEntryDoc);

@Schema({ timestamps: true, collection: "sessions" })
export class SessionDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String })
  trainingId?: string;

  @Prop({ type: String })
  routineId?: string;

  // Se guarda como Date para poder ordenar y filtrar por rango.
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Number })
  durationSeconds?: number;

  @Prop({ type: [SessionEntrySchema], default: [] })
  entries!: SessionEntryDoc[];

  @Prop({ type: String })
  notes?: string;
}

export type SessionDocument = HydratedDocument<SessionDoc>;
export const SessionSchema = SchemaFactory.createForClass(SessionDoc);

// Casi todas las lecturas son "mis sesiones, de la más reciente a la más antigua".
SessionSchema.index({ userId: 1, date: -1 });
