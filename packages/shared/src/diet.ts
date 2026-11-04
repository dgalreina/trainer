import { z } from "zod";
import { ageFromBirthDate, type ActivityLevel, type Goal, type Sex, GOALS } from "./profile";
import { type Macros, ZERO_MACROS, foodMacros, sumMacros } from "./food";

/** Fecha de calendario sin hora, "AAAA-MM-DD". */
const dateSchema = z.iso.date();

export const MAX_MEAL_ITEMS = 30;
export const MAX_MEAL_GRAMS = 5000;

/** Una cantidad de un alimento dentro de una comida. Las macros las calcula el código. */
export const mealItemSchema = z.object({
  foodId: z.string(),
  grams: z.number().positive().max(MAX_MEAL_GRAMS),
});
export type MealItem = z.infer<typeof mealItemSchema>;

/** Hora del día "HH:MM". */
export const mealTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

/** Una comida del día de la dieta: "Desayuno" a las 08:30, con sus alimentos. */
export const mealSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  time: mealTimeSchema,
  items: z.array(mealItemSchema).max(MAX_MEAL_ITEMS),
});
export type Meal = z.infer<typeof mealSchema>;

export const createMealSchema = mealSchema.omit({ id: true });
export type CreateMeal = z.input<typeof createMealSchema>;

export const updateMealSchema = createMealSchema.partial();
export type UpdateMeal = z.input<typeof updateMealSchema>;

// Sin valores por defecto dentro del `.partial()`: un campo ausente no se toca (ver training.ts).
const dietFields = {
  name: z.string().trim().min(1).max(100),
  goal: z.enum(GOALS),
  startDate: dateSchema,
};

/**
 * Dieta: un plan con nombre, objetivo y fecha de inicio que contiene las comidas de un día
 * tipo. Las calorías y macros objetivo no se guardan: se calculan (`calculateTargets`) con
 * los datos del usuario, que cambian (el peso, sobre todo).
 */
export const dietSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ...dietFields,
  meals: z.array(mealSchema),
});
export type Diet = z.infer<typeof dietSchema>;

/** Al crearla no lleva comidas: se añaden después, una a una. */
export const createDietSchema = z.object(dietFields);
export type CreateDiet = z.input<typeof createDietSchema>;

export const updateDietSchema = z.object(dietFields).partial();
export type UpdateDiet = z.input<typeof updateDietSchema>;

// ---------------------------------------------------------------------------------------------
// Totales de una dieta

/** Lo mínimo de un alimento para calcular macros. */
type FoodNutrition = Pick<Macros, "kcal" | "protein" | "carbs" | "fat">;

/** Macros de una comida; los alimentos que ya no existan en `foods` se ignoran. */
export function mealMacros(meal: Pick<Meal, "items">, foods: Map<string, FoodNutrition>): Macros {
  return sumMacros(
    meal.items.flatMap((item) => {
      const food = foods.get(item.foodId);
      return food ? [foodMacros(food, item.grams)] : [];
    }),
  );
}

/** Macros de todo un día de la dieta. */
export function dietMacros(diet: Pick<Diet, "meals">, foods: Map<string, FoodNutrition>): Macros {
  return diet.meals.length === 0
    ? ZERO_MACROS
    : sumMacros(diet.meals.map((meal) => mealMacros(meal, foods)));
}

// ---------------------------------------------------------------------------------------------
// Objetivo diario de calorías y macros. Lo calcula el código, nunca la IA.

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muy_intenso: 1.9,
};

/** Ajuste de calorías sobre el gasto según el objetivo. */
const GOAL_ADJUSTMENT: Record<Goal, number> = {
  perder_grasa: 0.85,
  mantener: 1,
  ganar_musculo: 1.1,
};

/** Tope duro: nunca un déficit mayor del 25 % del gasto, pase lo que pase. */
const MAX_DEFICIT = 0.25;
/** Calorías mínimas seguras por sexo; además, nunca por debajo del metabolismo basal. */
const MIN_KCAL: Record<Sex, number> = { mujer: 1200, hombre: 1500 };

/** Gramos de proteína por kg de peso según el objetivo. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  perder_grasa: 2,
  mantener: 1.6,
  ganar_musculo: 1.8,
};
/** Parte de las calorías que va a grasa. */
const FAT_SHARE = 0.25;
/** La proteína nunca pasa de esta parte de las calorías. */
const MAX_PROTEIN_SHARE = 0.35;

export interface TargetInput {
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  /** Peso actual en kg. */
  weightKg: number | null;
  goal: Goal;
  /** Hoy, "AAAA-MM-DD": para calcular la edad. */
  today: string;
}

export interface DailyTargets extends Macros {
  /** Metabolismo basal (Mifflin-St Jeor). */
  bmr: number;
  /** Gasto diario estimado con la actividad. */
  tdee: number;
  /** El objetivo se ha subido hasta un mínimo seguro, no sale del ajuste normal. */
  raisedToSafeMinimum: boolean;
}

/** Datos del perfil que faltan para poder calcular. */
export function missingTargetData(input: Omit<TargetInput, "goal" | "today">): string[] {
  const missing: string[] = [];
  if (!input.sex) missing.push("sexo");
  if (!input.birthDate) missing.push("fecha de nacimiento");
  if (!input.heightCm) missing.push("altura");
  if (!input.activityLevel) missing.push("nivel de actividad");
  if (!input.weightKg) missing.push("peso");
  return missing;
}

/**
 * Calorías y macros diarios: metabolismo basal con Mifflin-St Jeor, gasto con el nivel de
 * actividad, ajuste según el objetivo y topes de seguridad. Devuelve null si falta algún dato.
 */
export function calculateTargets(input: TargetInput): DailyTargets | null {
  const { sex, birthDate, heightCm, activityLevel, weightKg, goal, today } = input;
  if (!sex || !birthDate || !heightCm || !activityLevel || !weightKg) return null;

  const age = ageFromBirthDate(birthDate, today);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "hombre" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTORS[activityLevel];

  const adjustment = Math.max(GOAL_ADJUSTMENT[goal], 1 - MAX_DEFICIT);
  const wanted = tdee * adjustment;
  const floor = Math.max(MIN_KCAL[sex], bmr);
  // El mínimo seguro solo puede subir las calorías cuando se busca un déficit.
  const kcal = adjustment < 1 ? Math.max(wanted, Math.min(floor, tdee)) : wanted;

  const protein = Math.min(PROTEIN_PER_KG[goal] * weightKg, (kcal * MAX_PROTEIN_SHARE) / 4);
  const fat = (kcal * FAT_SHARE) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);

  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    raisedToSafeMinimum: adjustment < 1 && kcal > wanted,
  };
}
