import { z } from "zod";

import { techniqueSchema } from "./routine";

/** Una serie realizada. */
export const performedSetSchema = z.object({
  reps: z.number().int().min(0).max(1000),
  /** Peso en kg. 0 para ejercicios con el propio peso corporal. */
  weightKg: z.number().min(0).max(1000),
  /** Esfuerzo percibido (1-10). */
  rpe: z.number().min(1).max(10).optional(),
});
export type PerformedSet = z.infer<typeof performedSetSchema>;

export const sessionEntrySchema = z.object({
  exerciseId: z.string(),
  sets: z.array(performedSetSchema).min(1).max(50),
  /** Técnica con la que se hizo; ausente = serie normal. */
  technique: techniqueSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

/** Un entreno realizado: lo que de verdad hiciste en una fecha. */
export const workoutSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Entrenamiento y rutina de los que se partió, si se partió de alguno. */
  trainingId: z.string().optional(),
  routineId: z.string().optional(),
  /** Fecha y hora de inicio en ISO 8601. */
  date: z.iso.datetime({ offset: true }),
  /** Duración total, de pulsar «Comenzar» a «Finalizar». */
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  entries: z.array(sessionEntrySchema).min(1).max(50),
  notes: z.string().trim().max(1000).optional(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const createWorkoutSessionSchema = workoutSessionSchema.omit({
  id: true,
  userId: true,
});
export type CreateWorkoutSession = z.input<typeof createWorkoutSessionSchema>;

/**
 * De una sesión ya guardada se corrige lo que se escribió mal o se olvidó: cuándo empezó (también arrastrándola en el
 * calendario), cuánto duró y los ejercicios con sus series (se pueden quitar y añadir). Basta con enviar lo que cambia.
 */
export const updateWorkoutSessionSchema = z
  .object({
    date: z.iso.datetime({ offset: true }),
    durationSeconds: z.number().int().min(0).max(86_400),
    entries: z.array(sessionEntrySchema).min(1).max(50),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: "No hay nada que cambiar" });
export type UpdateWorkoutSession = z.input<typeof updateWorkoutSessionSchema>;
