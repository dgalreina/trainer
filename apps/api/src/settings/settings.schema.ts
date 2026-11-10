import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "settings" })
export class SettingsDoc {
  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  @Prop({ type: String, default: null })
  activeTrainingId!: string | null;

  @Prop({ type: String, default: null })
  activeDietId!: string | null;

  @Prop({ type: [{ _id: false, from: String, dietId: { type: String, default: null } }], default: [] })
  dietSchedule!: { from: string; dietId: string | null }[];

  // Minutos desde las 00:00 a los que empieza el día del usuario (0 = el día normal).
  @Prop({ type: Number, default: 0 })
  dayStartMinutes!: number;
}

export type SettingsDocument = HydratedDocument<SettingsDoc>;
export const SettingsSchema = SchemaFactory.createForClass(SettingsDoc);
