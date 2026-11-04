import { z } from "zod";
import { type Macros, sumMacros } from "./food";
import { MAX_MEAL_ITEMS, mealItemSchema } from "./diet";

const mealNameSchema = z.string().trim().min(1).max(60);

/**
 * Un alimento tal y como se comió. Las macros se guardan en el momento de registrarlo: si
 * después se edita el alimento del catálogo, lo ya comido no cambia.
 */
export const loggedItemSchema = mealItemSchema.extend({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});
export type LoggedItem = z.infer<typeof loggedItemSchema>;

/** Lo que el usuario comió de verdad, con su hora. Es lo realizado; la dieta es lo planeado. */
export const mealLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Momento en que se comió, ISO 8601. */
  date: z.iso.datetime({ offset: true }),
  name: mealNameSchema,
  items: z.array(loggedItemSchema),
});
export type MealLog = z.infer<typeof mealLogSchema>;

/** Al registrar solo se manda qué y cuántos gramos: las macros las calcula el servidor. */
export const createMealLogSchema = z.object({
  date: z.iso.datetime({ offset: true }),
  name: mealNameSchema,
  items: z.array(mealItemSchema).min(1).max(MAX_MEAL_ITEMS),
});
export type CreateMealLog = z.input<typeof createMealLogSchema>;

// Sin valores por defecto dentro del `.partial()`: lo que no llega no se toca.
export const updateMealLogSchema = createMealLogSchema.partial();
export type UpdateMealLog = z.input<typeof updateMealLogSchema>;

/** Calorías y macros de lo comido en una o varias comidas. */
export function loggedMacros(logs: Pick<MealLog, "items">[]): Macros {
  return sumMacros(logs.flatMap((log) => log.items));
}
