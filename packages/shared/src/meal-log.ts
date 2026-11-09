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
  /**
   * Si esta comida es la versión de ese día de una comida de la dieta (porque se editó o se movió),
   * el id de la comida de la dieta. La plantilla de la dieta no cambia: esto es solo esta instancia.
   */
  dietMealId: z.string().optional(),
  /** Comida de la dieta que ese día se ha quitado: no cuenta ni se muestra, solo evita que reaparezca. */
  skipped: z.boolean().optional(),
});
export type MealLog = z.infer<typeof mealLogSchema>;

/**
 * Al registrar solo se manda qué y cuántos gramos: las macros las calcula el servidor. Una comida
 * descartada (`skipped`) puede ir sin alimentos; el resto necesita al menos uno.
 */
export const createMealLogSchema = z
  .object({
    date: z.iso.datetime({ offset: true }),
    name: mealNameSchema,
    items: z.array(mealItemSchema).max(MAX_MEAL_ITEMS),
    dietMealId: z.string().optional(),
    skipped: z.boolean().optional(),
  })
  .refine((meal) => meal.skipped || meal.items.length > 0, {
    message: "Añade al menos un alimento",
    path: ["items"],
  });
export type CreateMealLog = z.input<typeof createMealLogSchema>;

// Sin valores por defecto dentro del `.partial()`: lo que no llega no se toca. `skipped` permite
// descartar una comida que venía de la dieta sin borrar su rastro.
export const updateMealLogSchema = z
  .object({
    date: z.iso.datetime({ offset: true }),
    name: mealNameSchema,
    items: z.array(mealItemSchema).min(1).max(MAX_MEAL_ITEMS),
    skipped: z.boolean(),
  })
  .partial();
export type UpdateMealLog = z.input<typeof updateMealLogSchema>;

/** Calorías y macros de lo comido en una o varias comidas (las descartadas no cuentan). */
export function loggedMacros(logs: Pick<MealLog, "items" | "skipped">[]): Macros {
  return sumMacros(logs.filter((log) => !log.skipped).flatMap((log) => log.items));
}
