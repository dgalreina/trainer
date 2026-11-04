import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  FOOD_CATEGORIES,
  type FoodCategory,
  type FoodPortion,
} from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "foods" })
export class FoodDoc {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // Nombre normalizado (sin tildes ni mayúsculas) para buscar y evitar duplicados.
  @Prop({ type: String, required: true })
  nameKey!: string;

  @Prop({ type: String, enum: FOOD_CATEGORIES, default: "otros" })
  category!: FoodCategory;

  // Por cada 100 g.
  @Prop({ type: Number, required: true })
  kcal!: number;

  @Prop({ type: Number, required: true })
  protein!: number;

  @Prop({ type: Number, required: true })
  carbs!: number;

  @Prop({ type: Number, required: true })
  fat!: number;

  @Prop({
    type: [{ _id: false, name: String, grams: Number }],
    default: [],
  })
  portions!: FoodPortion[];

  // null = catálogo base (no editable por usuarios).
  @Prop({ type: String, default: null })
  ownerId!: string | null;

  @Prop({ type: Boolean, default: false })
  archived!: boolean;
}

export type FoodDocument = HydratedDocument<FoodDoc>;
export const FoodSchema = SchemaFactory.createForClass(FoodDoc);

// Un nombre solo puede existir una vez por propietario (o una en el catálogo base).
FoodSchema.index({ ownerId: 1, nameKey: 1 }, { unique: true });
