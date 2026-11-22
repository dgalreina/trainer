import type { Diet } from "./diet";
import { mealMacros } from "./diet";
import { type Macros, sumMacros } from "./food";
import type { MealLog } from "./meal-log";

/** Una comida de un día tal y como la ve el calendario. */
export interface DayMeal {
  /** Hora "HH:MM" (la de la dieta, o la del registro en hora local). */
  time: string;
  name: string;
  macros: Macros;
  /**
   * `dieta`: viene de la dieta y no se ha tocado ese día (cuenta como comida salvo que se quite);
   * `cambiada`: versión de ese día de una comida de la dieta (editada o movida);
   * `añadida`: la registró el usuario por su cuenta.
   */
  origin: "dieta" | "cambiada" | "añadida";
}

export interface DayMeals {
  meals: DayMeal[];
  /** Comidas de la dieta que ese día el usuario ha quitado (no cuentan). */
  removed: string[];
}

/**
 * Lo comido un día, igual que lo cuenta el calendario: las comidas de la dieta que rige ese día cuentan salvo que ese día
 * se hayan editado, movido o quitado, más lo que el usuario registró. `logs` son los registros de ESE día (en hora local) y
 * `timeOf` da la hora local "HH:MM" de un registro. La dieta es la plantilla; lo registrado manda.
 */
export function dayMeals(input: {
  diet: Pick<Diet, "meals"> | null;
  logs: MealLog[];
  foods: Map<string, Pick<Macros, "kcal" | "protein" | "carbs" | "fat">>;
  timeOf: (log: MealLog) => string;
}): DayMeals {
  const { diet, logs, foods, timeOf } = input;
  const touched = new Set(logs.flatMap((l) => (l.dietMealId ? [l.dietMealId] : [])));
  const meals: DayMeal[] = [];
  for (const meal of diet?.meals ?? []) {
    if (touched.has(meal.id)) continue;
    meals.push({ time: meal.time, name: meal.name, macros: mealMacros(meal, foods), origin: "dieta" });
  }
  for (const log of logs) {
    if (log.skipped) continue;
    meals.push({
      time: timeOf(log),
      name: log.name,
      macros: sumMacros(log.items.map((i) => ({ kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat }))),
      origin: log.dietMealId ? "cambiada" : "añadida",
    });
  }
  const removed = logs.flatMap((l) => {
    if (!l.skipped || !l.dietMealId) return [];
    return [diet?.meals.find((m) => m.id === l.dietMealId)?.name ?? l.name];
  });
  return { meals: meals.sort((a, b) => a.time.localeCompare(b.time)), removed };
}
