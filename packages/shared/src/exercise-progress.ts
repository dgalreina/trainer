import type { WorkoutSession } from "./session";

/** 1RM estimada con la fórmula de Epley. Con una sola repetición es el propio peso; sin peso o sin repeticiones, 0. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Lo mejor de un ejercicio en un entreno. */
export interface ExercisePoint {
  /** Fecha del entreno (ISO 8601). */
  date: string;
  /** Mayor peso de sus series (0 si todas fueron con el propio cuerpo). */
  bestKg: number;
  /** Repeticiones de esa serie de más peso (la de más repeticiones si no hubo peso). */
  bestReps: number;
  /** Mayor 1RM estimada entre sus series (0 si ninguna tiene peso y repeticiones). */
  oneRepMax: number;
  /** Suma de kg × repeticiones. */
  volume: number;
}

/**
 * Cómo evoluciona un ejercicio: un punto por entreno en el que se hizo, del más antiguo al más reciente. Solo cuenta
 * lo realmente guardado en las sesiones; una serie sin repeticiones ni peso no es un dato.
 */
export function exerciseProgress(sessions: readonly WorkoutSession[], exerciseId: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const session of sessions) {
    let bestKg = 0;
    let bestReps = 0;
    let oneRepMax = 0;
    let volume = 0;
    let any = false;
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const set of entry.sets) {
        if (set.reps <= 0 && set.weightKg <= 0) continue;
        any = true;
        if (set.weightKg > bestKg || (set.weightKg === bestKg && set.reps > bestReps)) {
          bestKg = set.weightKg;
          bestReps = set.reps;
        }
        oneRepMax = Math.max(oneRepMax, estimateOneRepMax(set.weightKg, set.reps));
        volume += set.reps * set.weightKg;
      }
    }
    if (any) points.push({ date: session.date, bestKg, bestReps, oneRepMax: Math.round(oneRepMax * 10) / 10, volume: Math.round(volume) });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Los ejercicios con algún dato en las sesiones: cuántas veces y cuándo fue la última. Los más recientes primero. */
export function exercisesDone(sessions: readonly WorkoutSession[]): { exerciseId: string; count: number; lastDate: string }[] {
  const found = new Map<string, { count: number; lastDate: string }>();
  for (const session of sessions) {
    const seen = new Set<string>();
    for (const entry of session.entries) {
      if (seen.has(entry.exerciseId) || !entry.sets.some((s) => s.reps > 0 || s.weightKg > 0)) continue;
      seen.add(entry.exerciseId);
      const current = found.get(entry.exerciseId);
      if (!current) found.set(entry.exerciseId, { count: 1, lastDate: session.date });
      else found.set(entry.exerciseId, { count: current.count + 1, lastDate: current.lastDate > session.date ? current.lastDate : session.date });
    }
  }
  return [...found].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

/** Con peso se mide por kilos; si nunca llevó peso (dominadas, flexiones), por repeticiones. */
export function progressMetric(points: readonly ExercisePoint[]): "kg" | "reps" {
  return points.some((p) => p.bestKg > 0) ? "kg" : "reps";
}

const valueOf = (p: ExercisePoint, metric: "kg" | "reps") => (metric === "kg" ? p.bestKg : p.bestReps);

export interface ProgressSummary {
  metric: "kg" | "reps";
  /** El punto con el mejor valor (el más reciente si se repite). */
  best: ExercisePoint;
  first: ExercisePoint;
  last: ExercisePoint;
  /** Cambio en % del último entreno frente al último que fue al menos 30 días antes; null si no hay con qué comparar. */
  monthChangePct: number | null;
}

export function summarizeProgress(points: readonly ExercisePoint[]): ProgressSummary | null {
  if (points.length === 0) return null;
  const metric = progressMetric(points);
  const last = points[points.length - 1];
  let best = points[0];
  for (const p of points) if (valueOf(p, metric) >= valueOf(best, metric)) best = p;
  const cutoff = new Date(last.date).getTime() - 30 * 86_400_000;
  const base = [...points].reverse().find((p) => new Date(p.date).getTime() <= cutoff);
  const baseValue = base ? valueOf(base, metric) : 0;
  const monthChangePct = base && baseValue > 0 ? Math.round(((valueOf(last, metric) - baseValue) / baseValue) * 1000) / 10 : null;
  return { metric, best, first: points[0], last, monthChangePct };
}
