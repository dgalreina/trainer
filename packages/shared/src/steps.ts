import { z } from "zod";

/** Máximo de pasos que se acepta en un día (más allá es un error al teclear). */
export const MAX_STEPS = 100_000;

/**
 * Calorías que gasta andar por encima del basal, por kilo y por paso: ~0,5 kcal/kg/km con zancada de ~0,75 m
 * (≈ 1333 pasos/km). Con 80 kg, 10 000 pasos son unas 320 kcal. Orientativo, como lo de los entrenos.
 */
export const KCAL_PER_STEP_PER_KG = 0.0004;

/** Calorías (por encima del basal) de `steps` pasos con ese peso. */
export function stepsKcal(steps: number, weightKg: number): number {
  if (!(steps > 0) || !(weightKg > 0)) return 0;
  return steps * weightKg * KCAL_PER_STEP_PER_KG;
}

/**
 * Los pasos de un día: lo que se lleva andado desde las 00:00 hasta la hora del registro (acumulado, no los de un rato).
 * Hay uno por día; para actualizarlo se edita.
 */
export const stepEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Momento hasta el que cuentan los pasos, ISO 8601. */
  date: z.iso.datetime({ offset: true }),
  /** Día de calendario "AAAA-MM-DD" en la hora del dispositivo (el servidor no conoce la zona del usuario). */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(1).max(MAX_STEPS),
});
export type StepEntry = z.infer<typeof stepEntrySchema>;

export const createStepEntrySchema = stepEntrySchema.pick({ date: true, day: true, steps: true });
export type CreateStepEntry = z.input<typeof createStepEntrySchema>;

// Sin valores por defecto dentro del `.partial()`: lo que no llega no se toca.
export const updateStepEntrySchema = createStepEntrySchema.partial();
export type UpdateStepEntry = z.input<typeof updateStepEntrySchema>;
