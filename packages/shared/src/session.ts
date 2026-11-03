import { z } from "zod";

/** Una serie realizada. */
export const performedSetSchema = z.object({
  reps: z.number().int().min(0),
  /** Peso en kg. 0 para ejercicios con el propio peso corporal. */
  weightKg: z.number().min(0),
  /** Esfuerzo percibido (1-10). */
  rpe: z.number().min(1).max(10).optional(),
});
export type PerformedSet = z.infer<typeof performedSetSchema>;

export const sessionEntrySchema = z.object({
  exerciseId: z.string(),
  sets: z.array(performedSetSchema).min(1),
  linkedToNext: z.boolean().default(false),
  restPause: z.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

/** Un entreno realizado: lo que de verdad hiciste en una fecha. */
export const workoutSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Rutina de la que se partió, si se partió de alguna. */
  routineId: z.string().optional(),
  /** Fecha y hora de inicio en ISO 8601. */
  date: z.iso.datetime({ offset: true }),
  entries: z.array(sessionEntrySchema).min(1),
  notes: z.string().trim().max(1000).optional(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const createWorkoutSessionSchema = workoutSessionSchema.omit({
  id: true,
  userId: true,
});
export type CreateWorkoutSession = z.input<typeof createWorkoutSessionSchema>;
