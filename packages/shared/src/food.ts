import { z } from "zod";
import { exerciseNameKey } from "./exercise";

export const FOOD_CATEGORIES = [
  "carne",
  "pescado",
  "huevos",
  "lacteos",
  "cereales",
  "legumbres",
  "verduras",
  "frutas",
  "frutos_secos",
  "grasas",
  "dulces",
  "bebidas",
  "otros",
] as const;

export const foodCategorySchema = z.enum(FOOD_CATEGORIES);
export type FoodCategory = z.infer<typeof foodCategorySchema>;

const foodNameSchema = z.string().trim().min(1).max(100);

/** Una medida casera de un alimento: "1 huevo" = 58 g. */
export const foodPortionSchema = z.object({
  name: z.string().trim().min(1).max(40),
  grams: z.number().positive().max(2000),
});
export type FoodPortion = z.infer<typeof foodPortionSchema>;

/** Calorías y macros de 100 g del alimento: lo único que se guarda; el resto lo calcula el código. */
export const foodNutritionFields = {
  kcal: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
};

const nutritionObject = z.object(foodNutritionFields);

/** 100 g no pueden llevar más de 100 g de macros (con un pequeño margen de redondeo). */
const macrosFitIn100g = (v: { protein?: number; carbs?: number; fat?: number }) =>
  (v.protein ?? 0) + (v.carbs ?? 0) + (v.fat ?? 0) <= 101;
const macrosMessage = { message: "Proteína, hidratos y grasa no pueden sumar más de 100 g por 100 g" };

/** Un alimento del catálogo: base (`ownerId` null) o creado por un usuario. */
export const foodSchema = z.object({
  id: z.string(),
  name: foodNameSchema,
  category: foodCategorySchema,
  ...foodNutritionFields,
  portions: z.array(foodPortionSchema).max(8),
  /** null en los del catálogo base: no se pueden editar ni borrar. */
  ownerId: z.string().nullable(),
  /** Se archiva en vez de borrar: las comidas ya guardadas siguen apuntando al alimento. */
  archived: z.boolean(),
});
export type Food = z.infer<typeof foodSchema>;

// Campos sin valores por defecto, compartidos por crear y editar: un `.default()` dentro de un
// `.partial()` rellenaría el campo ausente y machacaría el valor guardado al editar.
export const foodFields = {
  name: foodNameSchema,
  category: foodCategorySchema,
  ...foodNutritionFields,
  portions: z.array(foodPortionSchema).max(8),
};

export const createFoodSchema = z
  .object({
    ...foodFields,
    category: foodCategorySchema.default("otros"),
    portions: foodFields.portions.default([]),
  })
  .refine(macrosFitIn100g, macrosMessage);
export type CreateFood = z.input<typeof createFoodSchema>;

export const updateFoodSchema = z
  .object(foodFields)
  .partial()
  .extend({ archived: z.boolean().optional() })
  .refine(macrosFitIn100g, macrosMessage);
export type UpdateFood = z.infer<typeof updateFoodSchema>;

export const foodNameKey = exerciseNameKey;

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const round = (value: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Calorías y macros de `grams` gramos de un alimento. Siempre los calcula el código. */
export function foodMacros(food: z.infer<typeof nutritionObject>, grams: number): Macros {
  const k = grams / 100;
  return {
    kcal: round(food.kcal * k, 0),
    protein: round(food.protein * k, 1),
    carbs: round(food.carbs * k, 1),
    fat: round(food.fat * k, 1),
  };
}

/** Suma de varios macros (los de una comida o los de un día). */
export function sumMacros(list: Macros[]): Macros {
  const total = list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    ZERO_MACROS,
  );
  return {
    kcal: round(total.kcal, 0),
    protein: round(total.protein, 1),
    carbs: round(total.carbs, 1),
    fat: round(total.fat, 1),
  };
}
