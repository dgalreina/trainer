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

@Schema({ timestamps: true, collection: "routines" })
export class RoutineDoc {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // El orden de la lista es el orden de ejecución.
  @Prop({ type: [RoutineSlotSchema], default: [] })
  slots!: RoutineSlotDoc[];
}

export type RoutineDocument = HydratedDocument<RoutineDoc>;
export const RoutineSchema = SchemaFactory.createForClass(RoutineDoc);
