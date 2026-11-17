import {
  legacyTechnique,
  type CreateWorkoutSession,
  type PerformedSet,
  type Routine,
  type Technique,
  type WorkoutSession,
} from '@trainer/shared';

// Estado de un entreno en curso. Los números van como texto porque se editan en campos de
// texto; se convierten al guardar. Vive en el dispositivo (ver `draftKey`), no en el servidor:
// hasta pulsar «Finalizar» no es una sesión registrada.

export interface DraftSet {
  reps: string;
  weightKg: string;
  /** Marcada como hecha: solo estas se guardan (salvo que no haya ninguna marcada). */
  done: boolean;
}

export interface DraftEntry {
  exerciseId: string;
  sets: DraftSet[];
  /** Técnica especial; sin ella, serie normal. */
  technique?: Technique;
  /** Descanso propio del ejercicio; sin él, el de la rutina. */
  restSeconds?: number;
  /** Nota de la rutina para este ejercicio. */
  notes?: string;
  /** Lo que el usuario anota sobre cómo le ha ido el ejercicio; se guarda en la sesión. */
  feedback?: string;
  /** No se ha hecho hoy: la tarjeta se atenúa y el ejercicio no se guarda en la sesión. Solo vive en el borrador. */
  skipped?: boolean;
  /** Añadido a mano durante el entreno (no estaba en la rutina). Solo vive en el borrador. */
  added?: boolean;
  /** El ejercicio está terminado: la tarjeta se atenúa y se bloquea hasta «Retomar». Solo vive en el borrador. */
  finished?: boolean;
}

/** Tope de la nota del usuario (el mismo que tiene la entrada de la sesión). */
export const FEEDBACK_MAX_LENGTH = 500;

export interface WorkoutDraft {
  trainingId: string;
  routineId: string;
  /** Momento (ms) en que se pulsó «Comenzar», o null si aún no. */
  startedAt: number | null;
  entries: DraftEntry[];
  /** Momento (ms) en que acaba el descanso en curso. Es una hora, no una cuenta atrás: iOS suspende la web en segundo plano. */
  restEndsAt: number | null;
  /** Firma de la rutina con la que se creó (`routineSignature`): si cambia antes de empezar, se rehace. */
  planSig?: string;
}

/** Lo planeado de una rutina, en un texto comparable. */
export const routineSignature = (routine: Routine) => JSON.stringify(routine.slots);

export const draftKey = (trainingId: string, routineId: string) =>
  `trainer.draft.${trainingId}.${routineId}`;

const toText = (n?: number) => (n === undefined ? '' : String(n));

/**
 * Última vez que se hizo cada ejercicio (sesiones de la más reciente a la más antigua).
 * Sirve para precargar pesos y para la pista "Última vez".
 */
export function lastPerformed(sessions: WorkoutSession[]): Map<string, PerformedSet[]> {
  const last = new Map<string, PerformedSet[]>();
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (!last.has(entry.exerciseId)) last.set(entry.exerciseId, entry.sets);
    }
  }
  return last;
}

/** Entreno nuevo a partir de la rutina: el número de series es el planeado; los valores, los de la última vez y, sin historial, los planeados. */
export function buildDraft(
  trainingId: string,
  routine: Routine,
  last: Map<string, PerformedSet[]>,
): WorkoutDraft {
  return {
    trainingId,
    routineId: routine.id,
    startedAt: null,
    restEndsAt: null,
    planSig: routineSignature(routine),
    entries: routine.slots.map((slot, slotIndex) => {
      const previous = last.get(slot.exerciseId) ?? [];
      const planned = slot.sets.length > 0 ? slot.sets : previous;
      return {
        exerciseId: slot.exerciseId,
        // Una superserie en el último ejercicio (datos antiguos) no tiene «siguiente»: es una serie normal.
        technique: slot.technique === 'ss' && slotIndex === routine.slots.length - 1 ? undefined : slot.technique,
        restSeconds: slot.restSeconds,
        notes: slot.notes,
        sets: (planned.length > 0 ? planned : [{}]).map((set, i) => ({
          // Lo de la última vez manda (así no sale marcada ninguna diferencia nada más abrir); lo planeado, solo si no hay historial.
          reps: toText(previous[i]?.reps ?? set.reps),
          weightKg: toText(previous[i]?.weightKg ?? set.weightKg),
          done: false,
        })),
      };
    }),
  };
}

export function parseDraft(raw: string | null): WorkoutDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as WorkoutDraft;
    if (!Array.isArray(draft.entries) || typeof draft.routineId !== 'string') return null;
    // Borradores guardados con el formato antiguo (dos booleanos): se traducen a la técnica.
    draft.entries = draft.entries.map((e) =>
      e.technique === undefined ? { ...e, technique: legacyTechnique(e as { linkedToNext?: boolean; restPause?: boolean }) } : e,
    );
    return draft;
  } catch {
    return null;
  }
}

function parseNumber(text: string): number | undefined {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export interface WorkoutSummary {
  sets: number;
  /** Suma de kg × repeticiones. */
  volumeKg: number;
  durationSeconds: number | null;
}

/**
 * Lo que se guardaría al finalizar, o null si no hay ninguna serie válida. Cuenta solo las series
 * marcadas como hechas; si no hay ninguna marcada y `allSetsIfNoneDone`, cuentan todas las que
 * tengan repeticiones.
 */
export function toSessionPayload(
  draft: WorkoutDraft,
  now: number,
  allSetsIfNoneDone: boolean,
): { payload: CreateWorkoutSession; summary: WorkoutSummary } | null {
  // Los ejercicios que no se han hecho hoy no cuentan para nada: ni se guardan ni deciden qué series valen.
  const done = draft.entries.filter((e) => !e.skipped);
  const anyDone = done.some((e) => e.sets.some((s) => s.done));
  const useSet = (s: DraftSet) => (anyDone || !allSetsIfNoneDone ? s.done : true);

  const entries = done
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      technique: entry.technique,
      notes: entry.feedback?.trim() ? entry.feedback.trim().slice(0, FEEDBACK_MAX_LENGTH) : undefined,
      sets: entry.sets.filter(useSet).flatMap((s) => {
        const reps = parseNumber(s.reps);
        // Sin repeticiones no hay serie; sin peso es peso corporal (0 kg).
        return reps === undefined ? [] : [{ reps: Math.round(reps), weightKg: parseNumber(s.weightKg) ?? 0 }];
      }),
    }))
    .filter((entry) => entry.sets.length > 0);

  if (entries.length === 0) return null;

  const durationSeconds =
    draft.startedAt === null ? null : Math.max(0, Math.round((now - draft.startedAt) / 1000));
  const sets = entries.flatMap((e) => e.sets);

  return {
    payload: {
      trainingId: draft.trainingId,
      routineId: draft.routineId,
      date: new Date(draft.startedAt ?? now).toISOString(),
      durationSeconds: durationSeconds ?? undefined,
      entries,
    },
    summary: {
      sets: sets.length,
      volumeKg: Math.round(sets.reduce((total, s) => total + s.reps * s.weightKg, 0)),
      durationSeconds,
    },
  };
}

/** 75 → "1:15"; 3725 → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
