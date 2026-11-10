import { z } from "zod";
import { MAX_REST_SECONDS, plannedSetSchema, techniqueSchema } from "./routine";
import { MAX_TRAINING_WEEKS } from "./training";

/**
 * Plantilla de entrenamiento: un entrenamiento de ejemplo compartido por todos los usuarios. Los ejercicios van
 * por nombre (del catálogo base), no por id, para que sirva igual en cualquier base de datos; al usarla se
 * traducen a los ids. No lleva pesos: son de cada persona.
 */
export const templateSlotSchema = z.object({
  /** Nombre del ejercicio en el catálogo base. */
  exercise: z.string(),
  sets: z.array(plannedSetSchema),
  technique: techniqueSchema.optional(),
  restSeconds: z.number().int().min(0).max(MAX_REST_SECONDS).optional(),
  notes: z.string().optional(),
});
export type TemplateSlot = z.infer<typeof templateSlotSchema>;

export const templateRoutineSchema = z.object({
  name: z.string(),
  restSeconds: z.number().int().min(0).max(MAX_REST_SECONDS),
  slots: z.array(templateSlotSchema),
});
export type TemplateRoutine = z.infer<typeof templateRoutineSchema>;

export const trainingTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  durationWeeks: z.number().int().min(1).max(MAX_TRAINING_WEEKS),
  routines: z.array(templateRoutineSchema),
});
export type TrainingTemplate = z.infer<typeof trainingTemplateSchema>;

/** Al usar una plantilla solo hay que decir desde qué día empieza. */
export const useTemplateSchema = z.object({ startDate: z.iso.date() });
export type UseTemplate = z.input<typeof useTemplateSchema>;
