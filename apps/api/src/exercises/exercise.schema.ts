import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { EXERCISE_CATEGORIES, type ExerciseCategory } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "exercises" })
export class ExerciseDoc {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // Nombre normalizado (sin tildes ni mayúsculas) para buscar y evitar duplicados.
  @Prop({ type: String, required: true })
  nameKey!: string;

  @Prop({ type: String, enum: EXERCISE_CATEGORIES, default: "otros" })
  category!: ExerciseCategory;

  // null = catálogo base (no editable por usuarios).
  @Prop({ type: String, default: null })
  ownerId!: string | null;

  @Prop({ type: Boolean, default: false })
  archived!: boolean;
}

export type ExerciseDocument = HydratedDocument<ExerciseDoc>;
export const ExerciseSchema = SchemaFactory.createForClass(ExerciseDoc);

// Un nombre solo puede existir una vez por propietario (o una en el catálogo base).
ExerciseSchema.index({ ownerId: 1, nameKey: 1 }, { unique: true });
