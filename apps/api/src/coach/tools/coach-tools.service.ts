import { Injectable } from "@nestjs/common";
import {
  dayLabel,
  dayMeals,
  dietIdOn,
  dietMacros,
  mondayOfIso,
  searchExercises,
  searchFoods,
  sumMacros,
  trainingProgress,
} from "@trainer/shared";
import { DietsService } from "../../diets/diets.service.js";
import { ExercisesService } from "../../exercises/exercises.service.js";
import { FoodsService } from "../../foods/foods.service.js";
import { MealLogsService } from "../../meal-logs/meal-logs.service.js";
import { SessionsService } from "../../sessions/sessions.service.js";
import { SettingsService } from "../../settings/settings.service.js";
import { TrainingsService } from "../../trainings/trainings.service.js";
import { WeightsService } from "../../weights/weights.service.js";
import { NutritionTargetsService } from "../nutrition-targets.service.js";
import { CoachProposalsService, ProposalError } from "../proposals/coach-proposals.service.js";
import {
  dietDesignSchema,
  dietTargetsInput,
  exerciseProgressInput,
  nutritionSummaryInput,
  recentSessionsInput,
  searchExercisesInput,
  searchFoodsInput,
  trainingDesignSchema,
  weightTrendInput,
} from "./definitions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROGRESS_ROWS = 60;

/** La app es para España por ahora: los días y las horas de las comidas se cuentan en hora de Madrid, no en la del servidor (UTC). */
const TIME_ZONE = "Europe/Madrid";
const localFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** Día "AAAA-MM-DD" y hora "HH:MM" locales de un instante. */
function localParts(date: Date): { day: string; time: string } {
  const p = Object.fromEntries(localFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Un día de comidas tal y como se le cuenta a Claude. */
interface DaySummary {
  date: string;
  today?: true;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: string[];
  pendingToday?: string[];
  kcalIfAllPending?: number;
  removedFromDiet?: string[];
}

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const round1 = (n: number) => Math.round(n * 10) / 10;
const kg = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)));
/** «8×60» (repeticiones × kg). */
const setText = (s: { reps: number; weightKg: number }) => `${s.reps > 0 ? s.reps : "?"}×${kg(s.weightKg)}`;
/** Una serie planeada: puede no tener repeticiones o peso previstos («8×—», «—×60»). */
const plannedSetText = (s: { reps?: number; weightKg?: number }) =>
  `${s.reps ?? "—"}×${s.weightKg === undefined ? "—" : kg(s.weightKg)}`;

/** Lo que devuelve una herramienta: el resultado para Claude y, si preparó un entrenamiento, el id de la propuesta. */
export interface ToolOutcome {
  content: unknown;
  proposalId?: string;
  proposalKind?: "training" | "diet";
}

/**
 * Ejecuta las herramientas del entrenador. Cada una lee datos del usuario con los mismos servicios que usa la app y
 * devuelve un resultado compacto (pocas filas, texto corto): lo que se devuelve cuesta tokens en cada vuelta. Los números
 * se calculan aquí, nunca los inventa el modelo.
 */
@Injectable()
export class CoachToolsService {
  constructor(
    private readonly sessions: SessionsService,
    private readonly exercises: ExercisesService,
    private readonly weights: WeightsService,
    private readonly settings: SettingsService,
    private readonly trainings: TrainingsService,
    private readonly proposals: CoachProposalsService,
    private readonly foods: FoodsService,
    private readonly diets: DietsService,
    private readonly mealLogs: MealLogsService,
    private readonly nutrition: NutritionTargetsService,
  ) {}

  /** Ejecuta la herramienta `name`. Un fallo no rompe el chat: se devuelve `{ error }` para que Claude lo explique. */
  async run(userId: string, name: string, input: unknown): Promise<ToolOutcome> {
    try {
      if (name === "proposeTraining") return await this.proposeTraining(userId, input);
      if (name === "proposeDiet") return await this.proposeDiet(userId, input);
      return { content: await this.runRead(userId, name, input) };
    } catch {
      return { content: { error: "No he podido consultar ese dato ahora mismo." } };
    }
  }

  private async runRead(userId: string, name: string, input: unknown): Promise<unknown> {
    switch (name) {
      case "getRecentSessions":
        return await this.recentSessions(userId, recentSessionsInput.parse(input));
      case "getExerciseProgress":
        return await this.exerciseProgress(userId, exerciseProgressInput.parse(input));
      case "getWeightTrend":
        return await this.weightTrend(userId, weightTrendInput.parse(input));
      case "getActiveTraining":
        return await this.activeTraining(userId);
      case "searchExercises":
        return await this.searchCatalog(userId, searchExercisesInput.parse(input));
      case "getDietTargets":
        return await this.dietTargets(userId, dietTargetsInput.parse(input));
      case "searchFoods":
        return await this.searchFoodCatalog(userId, searchFoodsInput.parse(input));
      case "getNutritionSummary":
        return await this.nutritionSummary(userId, nutritionSummaryInput.parse(input));
      case "getActiveDiet":
        return await this.activeDiet(userId);
      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }

  private async searchCatalog(userId: string, { query }: { query: string }) {
    const found = searchExercises(await this.exercises.list(userId), query, 12);
    if (found.length === 0) {
      return { message: `No hay ningún ejercicio parecido a «${query}» en el catálogo. Puedes diseñar con él igualmente.` };
    }
    return { exercises: found.map((e) => ({ name: e.name, category: e.category })) };
  }

  /** Fase 1 → fase 2: valida el diseño libre, lo hace traducir y deja la propuesta guardada para la tarjeta del chat. */
  private async proposeTraining(userId: string, input: unknown): Promise<ToolOutcome> {
    const design = trainingDesignSchema.safeParse(input);
    if (!design.success) {
      const problem = design.error.issues[0];
      return { content: { error: `El diseño no es válido (${problem?.path.join(".") ?? ""}: ${problem?.message ?? ""}). Corrígelo y vuelve a llamar.` } };
    }
    try {
      const { proposal, substitutions } = await this.proposals.createTraining(userId, design.data);
      const exercises = proposal.training.routines.reduce((n, r) => n + r.slots.length, 0);
      return {
        proposalId: proposal.id,
        proposalKind: "training" as const,
        content: {
          ok: true,
          summary: `${proposal.training.routines.length} días, ${exercises} ejercicios, ${proposal.training.durationWeeks} semanas.`,
          // Ejercicios que se han cambiado por otro parecido: menciónalo con naturalidad para que lo que dices coincida con la tarjeta.
          ...(substitutions.length > 0 ? { exercisesChanged: substitutions } : {}),
          note:
            "La propuesta ya está lista y el usuario la ve como una tarjeta debajo de tu mensaje, con «Guardar como mi " +
            "entrenamiento» y «Pedir cambios». Resúmesela en pocas líneas (idea general y por qué) y dile que puede guardarla " +
            "o pedirte cambios. No digas que ya está guardada ni enumeres todos los ejercicios. Si hay exercisesChanged, di en una " +
            "frase cuáles has sustituido y por qué (por ejemplo «el curl nórdico invertido te lo he puesto como sissy squat»).",
        },
      };
    } catch (error) {
      return { content: { error: error instanceof ProposalError ? error.message : "No he podido preparar el entrenamiento ahora mismo." } };
    }
  }

  /** Fase 1 → fase 2 de una dieta (ver `CoachProposalsService.createDiet`). Los topes los comprueba el código. */
  private async proposeDiet(userId: string, input: unknown): Promise<ToolOutcome> {
    const design = dietDesignSchema.safeParse(input);
    if (!design.success) {
      const problem = design.error.issues[0];
      return { content: { error: `El diseño no es válido (${problem?.path.join(".") ?? ""}: ${problem?.message ?? ""}). Corrígelo y vuelve a llamar.` } };
    }
    try {
      const { proposal, substitutions } = await this.proposals.createDiet(userId, design.data);
      const { totals, meals } = proposal.diet;
      return {
        proposalId: proposal.id,
        proposalKind: "diet" as const,
        content: {
          ok: true,
          // Estas cifras las ha calculado la app con el catálogo: son las que ve el usuario en la tarjeta. No hagas cuentas propias.
          totalsPerDay: totals,
          meals: meals.map((m) => ({ name: m.name, time: m.time, kcal: m.macros.kcal })),
          ...(substitutions.length > 0 ? { foodsChanged: substitutions } : {}),
          note:
            "La propuesta ya está lista y el usuario la ve como una tarjeta debajo de tu mensaje, con «Guardar como mi " +
            "dieta» y «Pedir cambios». Resúmesela en pocas líneas (idea general, reparto de comidas y los totales de totalsPerDay) " +
            "y dile que puede guardarla o pedirte cambios. No digas que ya está guardada ni enumeres todos los alimentos. Si " +
            "hay foodsChanged, di en una frase cuáles has sustituido.",
        },
      };
    } catch (error) {
      return { content: { error: error instanceof ProposalError ? error.message : "No he podido preparar la dieta ahora mismo." } };
    }
  }

  private async dietTargets(userId: string, { goal }: { goal?: "perder_grasa" | "mantener" | "ganar_musculo" }) {
    const result = await this.nutrition.forUser(userId, goal);
    if ("missing" in result) {
      return {
        missing: result.missing,
        message: "Faltan estos datos del usuario. No diseñes la dieta todavía: pídeselos (los rellena en Yo > Mis datos, y el peso en Yo > Mi peso).",
      };
    }
    const { targets, limits } = result;
    return {
      goal: result.goal,
      suggestedPerDay: { kcal: targets.kcal, proteinG: targets.protein, carbsG: targets.carbs, fatG: targets.fat },
      hardLimitsPerDay: { minKcal: limits.minKcal },
      maintenanceKcal: targets.tdee,
      note: "Son orientativos. Diseña dentro de los topes duros; la app rechaza lo que se salga.",
    };
  }

  private async searchFoodCatalog(userId: string, { query }: { query: string }) {
    const found = searchFoods(await this.foods.list(userId), query, 10);
    if (found.length === 0) {
      return { message: `No hay ningún alimento parecido a «${query}» en el catálogo. Puedes diseñar con él igualmente.` };
    }
    return {
      foods: found.map((f) => ({
        name: f.name,
        category: f.category,
        per100g: { kcal: f.kcal, proteinG: f.protein, carbsG: f.carbs, fatG: f.fat },
        ...(f.portions.length > 0 ? { portions: f.portions.map((p) => `${p.name} = ${p.grams} g`) } : {}),
      })),
    };
  }

  /**
   * Lo comido los últimos días tal y como lo cuenta el calendario de la app: las comidas de la dieta cuentan salvo que ese
   * día se hayan quitado o cambiado, y lo que el usuario registró o editó manda sobre la dieta. Los días son de hora local.
   */
  private async nutritionSummary(userId: string, { days }: { days: number }) {
    const now = localParts(new Date());
    const [settings, catalogList, logs] = await Promise.all([
      this.settings.get(userId),
      this.foods.list(userId),
      // Un día de margen por los husos: luego se reparte por día local.
      this.mealLogs.list(userId, daysAgo(days + 1), new Date(Date.now() + DAY_MS)),
    ]);
    const catalog = new Map(catalogList.map((f) => [f.id, f]));
    const dietCache = new Map<string, Awaited<ReturnType<DietsService["get"]>> | null>();
    const dietOf = async (day: string) => {
      const id = dietIdOn(settings.dietSchedule, day);
      if (!id) return null;
      if (!dietCache.has(id)) dietCache.set(id, await this.diets.get(userId, id).catch(() => null));
      return dietCache.get(id) ?? null;
    };

    const perDay: DaySummary[] = [];
    for (let back = days - 1; back >= 0; back--) {
      const day = localParts(new Date(Date.now() - back * DAY_MS)).day;
      const dayLogs = logs.filter((l) => localParts(new Date(l.date)).day === day);
      const { meals, removed } = dayMeals({
        diet: await dietOf(day),
        logs: dayLogs,
        foods: catalog,
        timeOf: (l) => localParts(new Date(l.date)).time,
      });
      if (meals.length === 0 && removed.length === 0) continue;
      const isToday = day === now.day;
      // Hoy, lo que aún no ha llegado a su hora es «pendiente»: el calendario ya lo suma al día, pero no se lo ha comido todavía.
      const eaten = isToday ? meals.filter((m) => m.time <= now.time) : meals;
      const pending = isToday ? meals.filter((m) => m.time > now.time) : [];
      const total = sumMacros(eaten.map((m) => m.macros));
      const line = (m: (typeof meals)[number]) =>
        `${m.time} ${m.name} ${m.macros.kcal} kcal${m.origin === "dieta" ? " (de la dieta)" : m.origin === "cambiada" ? " (cambiada ese día)" : " (añadida por él)"}`;
      perDay.push({
        date: day,
        ...(isToday ? { today: true } : {}),
        kcal: total.kcal,
        proteinG: total.protein,
        carbsG: total.carbs,
        fatG: total.fat,
        meals: eaten.map(line),
        ...(pending.length > 0 ? { pendingToday: pending.map(line), kcalIfAllPending: sumMacros(meals.map((m) => m.macros)).kcal } : {}),
        ...(removed.length > 0 ? { removedFromDiet: removed } : {}),
      });
    }
    if (perDay.length === 0) return { message: `No hay comidas (ni de la dieta ni registradas) en los últimos ${days} días.` };
    // La media solo cuenta días completos (hoy aún no ha acabado).
    const full = perDay.filter((d) => !d.today);
    const avg = (pick: (d: (typeof perDay)[number]) => number) =>
      full.length === 0 ? null : Math.round(full.reduce((a, d) => a + pick(d), 0) / full.length);
    return {
      note:
        "Es lo mismo que ve el usuario en su calendario: las comidas de la dieta cuentan como comidas hechas salvo que las haya " +
        "quitado o cambiado ese día; lo que ha añadido o editado manda. Un día sin comidas ni dieta no aparece, y no significa que no comiera.",
      today: `${now.day} ${now.time}`,
      daysCounted: full.length,
      averageFullDays: full.length === 0 ? null : { kcal: avg((d) => d.kcal), proteinG: avg((d) => d.proteinG), carbsG: avg((d) => d.carbsG), fatG: avg((d) => d.fatG) },
      perDay,
    };
  }

  private async activeDiet(userId: string) {
    const settings = await this.settings.get(userId);
    if (!settings.activeDietId) return { message: "El usuario no tiene una dieta asignada." };
    const diet = await this.diets.get(userId, settings.activeDietId).catch(() => null);
    if (!diet) return { message: "El usuario no tiene una dieta asignada." };
    const catalog = new Map((await this.foods.list(userId)).map((f) => [f.id, f]));
    return {
      name: diet.name,
      goal: diet.goal,
      totalsPerDay: dietMacros(diet, catalog),
      meals: diet.meals.map((m) => ({
        name: m.name,
        time: m.time,
        foods: m.items.map((i) => `${catalog.get(i.foodId)?.name ?? "Alimento"} ${i.grams} g`),
      })),
    };
  }

  /** id → nombre de todos los ejercicios visibles para el usuario. */
  private async exerciseNames(userId: string): Promise<Map<string, string>> {
    return new Map((await this.exercises.list(userId)).map((e) => [e.id, e.name]));
  }

  private async recentSessions(userId: string, { days, limit }: { days: number; limit: number }) {
    const [sessions, names] = await Promise.all([
      this.sessions.list(userId, limit, daysAgo(days)),
      this.exerciseNames(userId),
    ]);
    if (sessions.length === 0) return { message: `No hay entrenos registrados en los últimos ${days} días.` };
    return {
      sessions: sessions.map((s) => ({
        date: s.date.slice(0, 10),
        minutes: s.durationSeconds === undefined ? null : Math.round(s.durationSeconds / 60),
        exercises: s.entries.map((e) => ({
          name: names.get(e.exerciseId) ?? "Ejercicio",
          sets: e.sets.map(setText).join(", "),
          ...(e.technique ? { technique: e.technique } : {}),
        })),
      })),
    };
  }

  private async exerciseProgress(userId: string, { exercise, weeks }: { exercise: string; weeks: number }) {
    const found = (await this.exercises.list(userId, exercise))[0];
    if (!found) return { error: `No encuentro ningún ejercicio llamado «${exercise}» en el catálogo del usuario.` };

    const sessions = await this.sessions.list(userId, 200, daysAgo(weeks * 7));
    const rows = sessions
      .map((s) => {
        const sets = s.entries.filter((e) => e.exerciseId === found.id).flatMap((e) => e.sets);
        if (sets.length === 0) return null;
        // La mejor serie: la de más peso y, a igual peso, la de más repeticiones.
        const best = sets.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
        return { date: s.date.slice(0, 10), bestSet: setText(best), totalSets: sets.length };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .reverse(); // de la más antigua a la más reciente
    if (rows.length === 0) return { exercise: found.name, message: `No hay series de «${found.name}» en las últimas ${weeks} semanas.` };
    return { exercise: found.name, sessions: rows.slice(-MAX_PROGRESS_ROWS) };
  }

  private async weightTrend(userId: string, { weeks }: { weeks: number }) {
    const entries = await this.weights.list(userId, daysAgo(weeks * 7));
    if (entries.length === 0) return { message: `No hay pesadas registradas en las últimas ${weeks} semanas.` };

    const byWeek = new Map<string, number[]>();
    for (const e of entries) {
      const monday = mondayOfIso(e.date.slice(0, 10));
      byWeek.set(monday, [...(byWeek.get(monday) ?? []), e.weightKg]);
    }
    let previous: number | null = null;
    const weeklyAverages = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monday, values]) => {
        const avg = round1(values.reduce((a, b) => a + b, 0) / values.length);
        const row = {
          weekStarting: monday,
          avgKg: avg,
          weighIns: values.length,
          changeFromPreviousWeekKg: previous === null ? null : round1(avg - previous),
        };
        previous = avg;
        return row;
      });
    const first = weeklyAverages[0];
    const last = weeklyAverages[weeklyAverages.length - 1];
    return {
      weeklyAverages,
      overallChangeKg: weeklyAverages.length > 1 ? round1(last.avgKg - first.avgKg) : null,
      latestWeighIn: { date: entries[entries.length - 1].date.slice(0, 10), kg: entries[entries.length - 1].weightKg },
    };
  }

  private async activeTraining(userId: string) {
    const settings = await this.settings.get(userId);
    if (!settings.activeTrainingId) return { message: "El usuario no tiene un entrenamiento asignado." };
    const [training, names] = await Promise.all([
      this.trainings.get(userId, settings.activeTrainingId),
      this.exerciseNames(userId),
    ]);
    const progress = trainingProgress(training, new Date().toISOString().slice(0, 10));
    return {
      name: training.name,
      week: `${progress.week} de ${progress.totalWeeks}`,
      status: progress.status,
      routines: training.routines.map((r, i) => ({
        day: dayLabel(i),
        name: r.name || null,
        restSeconds: r.restSeconds,
        exercises: r.slots.map((slot) => ({
          name: names.get(slot.exerciseId) ?? "Ejercicio",
          plannedSets: slot.sets.map(plannedSetText).join(", "),
          ...(slot.technique ? { technique: slot.technique } : {}),
          ...(slot.notes ? { notes: slot.notes } : {}),
        })),
      })),
    };
  }
}
