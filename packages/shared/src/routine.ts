import { z } from "zod";

/** Una serie planificada: reps y peso son orientativos y opcionales. */
export const plannedSetSchema = z.object({
  reps: z.number().int().min(0).optional(),
  /** Peso en kg. */
  weightKg: z.number().min(0).optional(),
});
export type PlannedSet = z.infer<typeof plannedSetSchema>;

export const routineSlotSchema = z.object({
  exerciseId: z.string(),
  /** Una entrada por serie, en orden. */
  sets: z.array(plannedSetSchema).default([]),
  /** Superserie: va encadenado con el siguiente slot de la lista. */
  linkedToNext: z.boolean().default(false),
  restPause: z.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
});
export type RoutineSlot = z.infer<typeof routineSlotSchema>;

/**
 * Rutina: lo que planeas hacer un día de entreno (por ejemplo "Pecho + Espalda"). El orden
 * de `slots` es el de ejecución. No existe suelta: siempre vive dentro de un `Training`.
 * Lo que realmente haces cada día es una `WorkoutSession`.
 */
export const routineSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(100),
  slots: z.array(routineSlotSchema).min(1),
});
export type Routine = z.infer<typeof routineSchema>;

export const createRoutineSchema = routineSchema.omit({ id: true });
export type CreateRoutine = z.input<typeof createRoutineSchema>;

export const updateRoutineSchema = createRoutineSchema.partial();
export type UpdateRoutine = z.input<typeof updateRoutineSchema>;
