import { Injectable } from "@nestjs/common";
import { dayLabel, mondayOfIso, trainingProgress } from "@trainer/shared";
import { ExercisesService } from "../../exercises/exercises.service.js";
import { SessionsService } from "../../sessions/sessions.service.js";
import { SettingsService } from "../../settings/settings.service.js";
import { TrainingsService } from "../../trainings/trainings.service.js";
import { WeightsService } from "../../weights/weights.service.js";
import { exerciseProgressInput, recentSessionsInput, weightTrendInput } from "./definitions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROGRESS_ROWS = 60;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const round1 = (n: number) => Math.round(n * 10) / 10;
const kg = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)));
/** «8×60» (repeticiones × kg). */
const setText = (s: { reps: number; weightKg: number }) => `${s.reps}×${kg(s.weightKg)}`;
/** Una serie planeada: puede no tener repeticiones o peso previstos («8×—», «—×60»). */
const plannedSetText = (s: { reps?: number; weightKg?: number }) =>
  `${s.reps ?? "—"}×${s.weightKg === undefined ? "—" : kg(s.weightKg)}`;

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
  ) {}

  /** Ejecuta la herramienta `name`. Un fallo no rompe el chat: se devuelve `{ error }` para que Claude lo explique. */
  async run(userId: string, name: string, input: unknown): Promise<unknown> {
    try {
      switch (name) {
        case "getRecentSessions":
          return await this.recentSessions(userId, recentSessionsInput.parse(input));
        case "getExerciseProgress":
          return await this.exerciseProgress(userId, exerciseProgressInput.parse(input));
        case "getWeightTrend":
          return await this.weightTrend(userId, weightTrendInput.parse(input));
        case "getActiveTraining":
          return await this.activeTraining(userId);
        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    } catch {
      return { error: "No he podido consultar ese dato ahora mismo." };
    }
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
