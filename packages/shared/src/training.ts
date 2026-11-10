import { z } from "zod";
import { routineSchema } from "./routine";

/** Fecha de calendario sin hora, "AAAA-MM-DD". */
const dateSchema = z.iso.date();

export const MAX_TRAINING_WEEKS = 104;

// Los campos de un entrenamiento, sin valores por defecto. Se comparten entre crear y editar:
// en editar un campo ausente debe quedarse como está, y con un `.default()` dentro de un
// `.partial()` Zod lo rellenaría y machacaría el valor guardado.
const trainingFields = {
  name: z.string().trim().min(1).max(100),
  startDate: dateSchema,
  durationWeeks: z.number().int().min(1).max(MAX_TRAINING_WEEKS),
};

/**
 * Entrenamiento (por ejemplo "Fuerza"): un bloque con fecha de inicio y duración en
 * semanas que agrupa las rutinas de cada día ("Pecho + Espalda", "Pierna"...).
 */
export const trainingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ...trainingFields,
  routines: z.array(routineSchema),
});
export type Training = z.infer<typeof trainingSchema>;

/** Al crearlo no lleva rutinas: se añaden después, una a una. */
export const createTrainingSchema = z.object(trainingFields);
export type CreateTraining = z.input<typeof createTrainingSchema>;

export const updateTrainingSchema = z.object(trainingFields).partial();
export type UpdateTraining = z.input<typeof updateTrainingSchema>;

export type TrainingStatus = "upcoming" | "active" | "finished";

export interface TrainingProgress {
  status: TrainingStatus;
  /** Semana en curso (1-based). Antes de empezar vale 0; al acabar, `totalWeeks`. */
  week: number;
  totalWeeks: number;
  /** Último día del entrenamiento, "AAAA-MM-DD". */
  endDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toDayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

/**
 * En qué punto va un entrenamiento el día `today` ("AAAA-MM-DD"). Se calcula por días de
 * calendario, sin horas, para que no cambie con el huso horario.
 */
export function trainingProgress(
  training: Pick<Training, "startDate" | "durationWeeks">,
  today: string,
): TrainingProgress {
  const start = toDayNumber(training.startDate);
  const totalDays = training.durationWeeks * 7;
  const elapsed = toDayNumber(today) - start;
  const endDate = new Date((start + totalDays - 1) * DAY_MS).toISOString().slice(0, 10);

  if (elapsed < 0) {
    return { status: "upcoming", week: 0, totalWeeks: training.durationWeeks, endDate };
  }
  if (elapsed >= totalDays) {
    return { status: "finished", week: training.durationWeeks, totalWeeks: training.durationWeeks, endDate };
  }
  return {
    status: "active",
    week: Math.floor(elapsed / 7) + 1,
    totalWeeks: training.durationWeeks,
    endDate,
  };
}

/** Hora de inicio del día en minutos desde las 00:00 (de 0 a 23:59). */
export const dayStartMinutesSchema = z.number().int().min(0).max(1439);

/** Lo que el usuario tiene en marcha ahora. */
export const dietScheduleEntrySchema = z.object({
  /** Día (AAAA-MM-DD) desde el que rige: se mantiene hasta la siguiente entrada. */
  from: dateSchema,
  /** La dieta que se sigue desde ese día, o null si se deja de seguir una. */
  dietId: z.string().nullable(),
});
export type DietScheduleEntry = z.infer<typeof dietScheduleEntrySchema>;

export const userSettingsSchema = z.object({
  activeTrainingId: z.string().nullable(),
  activeDietId: z.string().nullable(),
  /** Qué dieta rige cada día: sin fin hasta que se cambia o se quita, y antes de cada cambio rige la anterior. */
  dietSchedule: z.array(dietScheduleEntrySchema),
  /** A qué hora empieza el día para el usuario, en minutos desde las 00:00 (0 = el día normal; 600 = a las 10:00). */
  dayStartMinutes: dayStartMinutesSchema,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const updateUserSettingsSchema = z.object({
  activeTrainingId: z.string().nullable().optional(),
  activeDietId: z.string().nullable().optional(),
  /** Día desde el que rige el cambio de `activeDietId` (por defecto, hoy en el servidor). */
  dietSince: dateSchema.optional(),
  dayStartMinutes: dayStartMinutesSchema.optional(),
});
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

/** La dieta que rige el día `day` (AAAA-MM-DD): la de la última entrada que empieza ese día o antes. */
export function dietIdOn(schedule: DietScheduleEntry[], day: string): string | null {
  let found: string | null = null;
  let foundFrom = "";
  for (const entry of schedule) {
    if (entry.from <= day && entry.from >= foundFrom) {
      found = entry.dietId;
      foundFrom = entry.from;
    }
  }
  return found;
}
