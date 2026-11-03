import type {
  CreateWorkoutSession,
  PerformedSet,
  Routine,
  WorkoutSession,
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
  linkedToNext: boolean;
  restPause: boolean;
}

export interface WorkoutDraft {
  trainingId: string;
  routineId: string;
  /** Momento (ms) en que se pulsó «Comenzar», o null si aún no. */
  startedAt: number | null;
  entries: DraftEntry[];
  /** Descanso entre series, en segundos. 0 = sin temporizador. */
  restSeconds: number;
  /** Momento (ms) en que acaba el descanso en curso. Es una hora, no una cuenta atrás: iOS suspende la web en segundo plano. */
  restEndsAt: number | null;
}

export const REST_OPTIONS = [0, 60, 90, 120, 180] as const;
export const DEFAULT_REST_SECONDS = 90;
export const REST_PREFERENCE_KEY = 'trainer.restSeconds';

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

/** Entreno nuevo a partir de la rutina: lo planeado manda; si no hay dato, lo de la última vez. */
export function buildDraft(
  trainingId: string,
  routine: Routine,
  last: Map<string, PerformedSet[]>,
  restSeconds: number,
): WorkoutDraft {
  return {
    trainingId,
    routineId: routine.id,
    startedAt: null,
    restSeconds,
    restEndsAt: null,
    entries: routine.slots.map((slot) => {
      const previous = last.get(slot.exerciseId) ?? [];
      const planned = slot.sets.length > 0 ? slot.sets : previous;
      return {
        exerciseId: slot.exerciseId,
        linkedToNext: slot.linkedToNext,
        restPause: slot.restPause,
        sets: (planned.length > 0 ? planned : [{}]).map((set, i) => ({
          reps: toText(set.reps ?? previous[i]?.reps),
          weightKg: toText(set.weightKg ?? previous[i]?.weightKg),
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
    return Array.isArray(draft.entries) && typeof draft.routineId === 'string' ? draft : null;
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
  const anyDone = draft.entries.some((e) => e.sets.some((s) => s.done));
  const useSet = (s: DraftSet) => (anyDone || !allSetsIfNoneDone ? s.done : true);

  const entries = draft.entries
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      linkedToNext: entry.linkedToNext,
      restPause: entry.restPause,
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
