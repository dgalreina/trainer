import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { GOALS, type Goal } from "@trainer/shared";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class MealItemDoc {
  @Prop({ type: String, required: true })
  foodId!: string;

  @Prop({ type: Number, required: true })
  grams!: number;
}
const MealItemSchema = SchemaFactory.createForClass(MealItemDoc);

// Con `_id` propio: más adelante el registro de lo comido apuntará a la comida por ese id.
@Schema()
export class MealDoc {
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  // Hora del día "HH:MM".
  @Prop({ type: String, required: true })
  time!: string;

  @Prop({ type: [MealItemSchema], default: [] })
  items!: MealItemDoc[];
}
const MealSchema = SchemaFactory.createForClass(MealDoc);

@Schema({ timestamps: true, collection: "diets" })
export class DietDoc {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: GOALS, required: true })
  goal!: Goal;

  // Día de calendario "AAAA-MM-DD", sin hora.
  @Prop({ type: String, required: true })
  startDate!: string;

  @Prop({ type: [MealSchema], default: [] })
  meals!: MealDoc[];
}

export type DietDocument = HydratedDocument<DietDoc>;
export const DietSchema = SchemaFactory.createForClass(DietDoc);
