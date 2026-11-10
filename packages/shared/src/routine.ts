import { z } from "zod";

/** Descansos entre series que ofrece la app, en segundos. 0 = sin temporizador. */
export const REST_SECONDS_OPTIONS = [0, 60, 90, 120, 180] as const;
export const DEFAULT_REST_SECONDS = 90;
export const MAX_REST_SECONDS = 600;

const restSecondsSchema = z.number().int().min(0).max(MAX_REST_SECONDS);

/**
 * Técnica de una serie especial, excluyentes entre sí (sin técnica = serie normal):
 * - `ss` superserie: va encadenado con el siguiente ejercicio de la lista, sin descanso entre ambos.
 * - `rp` rest-pause.
 * - `desc` serie descendente: se baja el peso y se sigue sin descanso.
 */
export const TECHNIQUES = ["ss", "rp", "desc"] as const;
export const techniqueSchema = z.enum(TECHNIQUES);
export type Technique = z.infer<typeof techniqueSchema>;

/** Cómo se llama cada técnica en pantalla. */
export const TECHNIQUE_LABELS: Record<Technique, string> = {
  ss: "Superserie",
  rp: "Rest-pause",
  desc: "Descendente",
};

/**
 * La técnica de un ejercicio guardado con el formato antiguo (dos booleanos). Una superserie con rest-pause
 * se queda en superserie.
 */
export function legacyTechnique(flags: { linkedToNext?: boolean; restPause?: boolean }): Technique | undefined {
  return flags.linkedToNext ? "ss" : flags.restPause ? "rp" : undefined;
}

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
  /** Técnica especial; ausente = serie normal. */
  technique: techniqueSchema.optional(),
  /** Descanso entre series de este ejercicio; ausente = el de la rutina. En una superserie cuenta el del último ejercicio. */
  restSeconds: restSecondsSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});
export type RoutineSlot = z.infer<typeof routineSlotSchema>;

/**
 * Rutina: lo que planeas hacer un día de entreno (por ejemplo "Pecho + Espalda"). El orden
 * de `slots` es el de ejecución. No existe suelta: siempre vive dentro de un `Training`.
 * Lo que realmente haces cada día es una `WorkoutSession`.
 */
// Los campos de una rutina, sin valores por defecto: se comparten entre crear y editar (con un
// `.default()` dentro de un `.partial()`, Zod rellenaría el campo ausente y machacaría lo guardado).
const routineFields = {
  /** Opcional: «Día 1», «Día 2»… es la posición en el entrenamiento, no el nombre. */
  name: z.string().trim().max(100),
  /** Puede estar vacía: se crea "Día 1", "Día 2"... y los ejercicios se añaden después. */
  slots: z.array(routineSlotSchema),
  /** Descanso entre series de esta rutina. Se fija aquí, no mientras se entrena. */
  restSeconds: restSecondsSchema,
};

export const routineSchema = z.object({ id: z.string(), ...routineFields });
export type Routine = z.infer<typeof routineSchema>;

export const createRoutineSchema = z.object({
  ...routineFields,
  name: routineFields.name.default(""),
  slots: routineFields.slots.default([]),
  restSeconds: restSecondsSchema.default(DEFAULT_REST_SECONDS),
});
export type CreateRoutine = z.input<typeof createRoutineSchema>;

export const updateRoutineSchema = z.object(routineFields).partial();
export type UpdateRoutine = z.input<typeof updateRoutineSchema>;

/** «Día 1», «Día 2»…: el lugar de la rutina dentro de su entrenamiento (índice desde 0). */
export const dayLabel = (index: number) => `Día ${index + 1}`;

/** Cómo se llama una rutina en pantalla: su nombre, o su día si todavía no tiene. */
export function routineTitle(routines: Routine[], routineId: string): string {
  const index = routines.findIndex((r) => r.id === routineId);
  const routine = routines[index];
  return routine?.name || (index >= 0 ? dayLabel(index) : "Rutina");
}
