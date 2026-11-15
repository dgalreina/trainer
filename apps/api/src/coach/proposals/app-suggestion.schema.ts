import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const SUGGESTION_STATUSES = ["open", "done", "dismissed"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * Algo que la IA quiso hacer y la app no puede representar (una técnica por serie, un ejercicio que falta en el catálogo…).
 * Se agrupa por `code` con un contador. NO guarda quién lo pidió: solo sirve para decidir qué mejorar en la app.
 */
@Schema({ timestamps: true, collection: "app_suggestions" })
export class AppSuggestionDoc {
  @Prop({ type: String, required: true, unique: true })
  code!: string;

  @Prop({ type: Number, default: 1 })
  count!: number;

  /** Unos pocos ejemplos de cómo lo describió la IA (los más recientes). */
  @Prop({ type: [String], default: [] })
  examples!: string[];

  @Prop({ type: String, enum: SUGGESTION_STATUSES, default: "open" })
  status!: SuggestionStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AppSuggestionDocument = HydratedDocument<AppSuggestionDoc>;
export const AppSuggestionSchema = SchemaFactory.createForClass(AppSuggestionDoc);
