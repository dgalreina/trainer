import { z } from "zod";

/**
 * Sexo para el cálculo de calorías (Mifflin-St Jeor distingue hombre y mujer). "no_indicado" es
 * "prefiero no decirlo": se calcula con el punto medio entre ambos.
 */
export const SEXES = ["mujer", "hombre", "no_indicado"] as const;
export type Sex = (typeof SEXES)[number];

/** Cuánto se mueve la persona en el día a día. Alimenta el cálculo de calorías. */
export const ACTIVITY_LEVELS = ["sedentario", "ligero", "moderado", "intenso", "muy_intenso"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const GOALS = ["perder_grasa", "mantener", "ganar_musculo"] as const;
export type Goal = (typeof GOALS)[number];

/**
 * Datos personales. Todos son opcionales: se rellenan cuando el usuario quiere, y `null` es
 * "sin dato". El servidor devuelve siempre el perfil completo, con `null` donde falta algo.
 */
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60).nullable(),
  /** Fecha de nacimiento "AAAA-MM-DD". La edad se calcula con `ageFromBirthDate`, no se guarda. */
  birthDate: z.iso.date().nullable(),
  sex: z.enum(SEXES).nullable(),
  heightCm: z.number().min(100).max(250).nullable(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullable(),
  goal: z.enum(GOALS).nullable(),
  /** Lesiones, limitaciones, preferencias: lo que el entrenador debe tener en cuenta. */
  notes: z.string().trim().max(1000).nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

// Sin valores por defecto dentro del `.partial()`: un campo ausente no se toca (ver training.ts).
export const updateProfileSchema = profileSchema.partial();
export type UpdateProfile = z.input<typeof updateProfileSchema>;

export const EMPTY_PROFILE: Profile = {
  name: null,
  birthDate: null,
  sex: null,
  heightCm: null,
  activityLevel: null,
  goal: null,
  notes: null,
};

/** Años cumplidos el día `today` ("AAAA-MM-DD"), por días de calendario. */
export function ageFromBirthDate(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
}

/** Una pesada: el peso con la fecha y hora a la que se midió. */
export const weightEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Momento de la pesada, ISO 8601. */
  date: z.iso.datetime({ offset: true }),
  weightKg: z.number().min(20).max(400),
});
export type WeightEntry = z.infer<typeof weightEntrySchema>;

export const createWeightEntrySchema = weightEntrySchema.pick({ date: true, weightKg: true });
export type CreateWeightEntry = z.input<typeof createWeightEntrySchema>;

// Sin valores por defecto dentro del `.partial()`: lo que no llega no se toca.
export const updateWeightEntrySchema = createWeightEntrySchema.partial();
export type UpdateWeightEntry = z.input<typeof updateWeightEntrySchema>;
