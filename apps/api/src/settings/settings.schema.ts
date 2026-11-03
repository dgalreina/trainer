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
}

export type SettingsDocument = HydratedDocument<SettingsDoc>;
export const SettingsSchema = SchemaFactory.createForClass(SettingsDoc);
