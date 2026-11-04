import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class LoggedItemDoc {
  @Prop({ type: String, required: true })
  foodId!: string;

  @Prop({ type: Number, required: true })
  grams!: number;

  // Macros de esa cantidad, guardadas al registrar: editar el alimento después no las cambia.
  @Prop({ type: Number, required: true })
  kcal!: number;

  @Prop({ type: Number, required: true })
  protein!: number;

  @Prop({ type: Number, required: true })
  carbs!: number;

  @Prop({ type: Number, required: true })
  fat!: number;
}
const LoggedItemSchema = SchemaFactory.createForClass(LoggedItemDoc);

@Schema({ timestamps: true, collection: "meal_logs" })
export class MealLogDoc {
  @Prop({ type: String, required: true })
  userId!: string;

  // El momento en que se comió, como Date para poder ordenar y consultar por rango.
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: [LoggedItemSchema], default: [] })
  items!: LoggedItemDoc[];
}

export type MealLogDocument = HydratedDocument<MealLogDoc>;
export const MealLogSchema = SchemaFactory.createForClass(MealLogDoc);

// Siempre se consulta "mis comidas, por fecha".
MealLogSchema.index({ userId: 1, date: -1 });
