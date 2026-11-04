import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { ActivityLevel, Goal, Sex } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "profiles" })
export class ProfileDoc {
  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  @Prop({ type: String, default: null })
  name!: string | null;

  // "AAAA-MM-DD": un día de calendario, sin hora.
  @Prop({ type: String, default: null })
  birthDate!: string | null;

  @Prop({ type: String, default: null })
  sex!: Sex | null;

  @Prop({ type: Number, default: null })
  heightCm!: number | null;

  @Prop({ type: String, default: null })
  activityLevel!: ActivityLevel | null;

  @Prop({ type: String, default: null })
  goal!: Goal | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export type ProfileDocument = HydratedDocument<ProfileDoc>;
export const ProfileSchema = SchemaFactory.createForClass(ProfileDoc);
