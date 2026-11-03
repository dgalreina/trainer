import type { Exercise, Routine } from '@trainer/shared';

/** Texto corto para tarjetas: "5 ejercicios · 15 series" y los primeros nombres. */
export function routineSummary(routine: Routine, byId: Map<string, Exercise>) {
  const sets = routine.slots.reduce((total, slot) => total + slot.sets.length, 0);
  const exercises = routine.slots.length;
  const names = routine.slots
    .slice(0, 3)
    .map((slot) => byId.get(slot.exerciseId)?.name)
    .filter((name): name is string => Boolean(name));
  const more = exercises > 3 ? ` y ${exercises - 3} más` : '';

  return {
    counts: `${exercises} ${exercises === 1 ? 'ejercicio' : 'ejercicios'} · ${sets} ${sets === 1 ? 'serie' : 'series'}`,
    preview: names.length ? `${names.join(', ')}${more}` : '',
  };
}
