import { z } from "zod";

export const EXERCISE_CATEGORIES = [
  "pecho",
  "espalda",
  "hombros",
  "biceps",
  "triceps",
  "piernas",
  "core",
  "antebrazo",
  "funcional",
  "olimpicos",
  "otros",
] as const;

export const exerciseCategorySchema = z.enum(EXERCISE_CATEGORIES);
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>;

const exerciseNameSchema = z.string().trim().min(1).max(100);

/** Un ejercicio del catálogo: base (`ownerId` null) o creado por un usuario. */
export const exerciseSchema = z.object({
  id: z.string(),
  name: exerciseNameSchema,
  category: exerciseCategorySchema,
  /** null en los del catálogo base: no se pueden editar ni borrar. */
  ownerId: z.string().nullable(),
  /**
   * En vez de borrar, se archiva: las sesiones pasadas siguen apuntando al
   * ejercicio y el historial no se rompe.
   */
  archived: z.boolean(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const createExerciseSchema = z.object({
  name: exerciseNameSchema,
  category: exerciseCategorySchema.default("otros"),
});
export type CreateExercise = z.input<typeof createExerciseSchema>;

export const updateExerciseSchema = createExerciseSchema
  .partial()
  .extend({ archived: z.boolean().optional() });
export type UpdateExercise = z.infer<typeof updateExerciseSchema>;

/**
 * Clave para comparar nombres sin distinguir mayúsculas, tildes ni espacios
 * sobrantes: "Press  Banca" y "press banca" son el mismo ejercicio.
 */
export function exerciseNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
