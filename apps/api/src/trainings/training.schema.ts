import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class PlannedSetDoc {
  @Prop({ type: Number })
  reps?: number;

  @Prop({ type: Number })
  weightKg?: number;
}
const PlannedSetSchema = SchemaFactory.createForClass(PlannedSetDoc);

@Schema({ _id: false })
export class RoutineSlotDoc {
  @Prop({ type: String, required: true })
  exerciseId!: string;

  // Una entrada por serie, en orden.
  @Prop({ type: [PlannedSetSchema], default: [] })
  sets!: PlannedSetDoc[];

  @Prop({ type: Boolean, default: false })
  linkedToNext!: boolean;

  @Prop({ type: Boolean, default: false })
  restPause!: boolean;

  @Prop({ type: String })
  notes?: string;
}
const RoutineSlotSchema = SchemaFactory.createForClass(RoutineSlotDoc);

// Con `_id` propio: las sesiones registradas apuntan a la rutina por ese id.
@Schema()
export class TrainingRoutineDoc {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // El orden de la lista es el orden de ejecución.
  @Prop({ type: [RoutineSlotSchema], default: [] })
  slots!: RoutineSlotDoc[];
}
const TrainingRoutineSchema = SchemaFactory.createForClass(TrainingRoutineDoc);

@Schema({ timestamps: true, collection: "trainings" })
export class TrainingDoc {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // Día de calendario "AAAA-MM-DD", sin hora: no depende del huso horario.
  @Prop({ type: String, required: true })
  startDate!: string;

  @Prop({ type: Number, required: true })
  durationWeeks!: number;

  // Descanso entre series de todo el entrenamiento, en segundos (0 = sin temporizador).
  @Prop({ type: Number, default: 90 })
  restSeconds!: number;

  @Prop({ type: [TrainingRoutineSchema], default: [] })
  routines!: TrainingRoutineDoc[];
}

export type TrainingDocument = HydratedDocument<TrainingDoc>;
export const TrainingSchema = SchemaFactory.createForClass(TrainingDoc);
