import type { WorkoutSession } from "./session";

/**
 * Volumen de un entreno: suma de kg × repeticiones de todas las series. Las series sin repeticiones anotadas
 * (reps 0 = «sin anotar») o sin peso (el propio cuerpo) no suman nada.
 */
export function sessionVolume(session: Pick<WorkoutSession, "entries">): number {
  let total = 0;
  for (const entry of session.entries) {
    for (const set of entry.sets) total += set.reps * set.weightKg;
  }
  return Math.round(total);
}

/** Número total de series de un entreno. */
export function sessionSetCount(session: Pick<WorkoutSession, "entries">): number {
  return session.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
}
