import type { Exercise, ExerciseCategory } from '@trainer/shared';
import { exerciseNameKey } from '@trainer/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ExercisesValue {
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (name: string, category: ExerciseCategory) => Promise<Exercise>;
  archive: (exercise: Exercise) => Promise<void>;
}

const ExercisesContext = createContext<ExercisesValue | null>(null);

const byName = (a: Exercise, b: Exercise) =>
  exerciseNameKey(a.name).localeCompare(exerciseNameKey(b.name));

/** Catálogo (base + propios) cargado una vez y compartido por todas las pantallas. */
export function ExercisesProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExercises(await api.get<Exercise[]>('/exercises'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar los ejercicios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') reload();
    else setExercises([]);
  }, [status, reload]);

  const create = useCallback(async (name: string, category: ExerciseCategory) => {
    const created = await api.post<Exercise>('/exercises', { name, category });
    // El servidor devuelve el existente si el nombre ya estaba: no se duplica en la lista.
    setExercises((prev) => [...prev.filter((e) => e.id !== created.id), created].sort(byName));
    return created;
  }, []);

  const archive = useCallback(async (exercise: Exercise) => {
    await api.delete(`/exercises/${exercise.id}`);
    setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
  }, []);

  const value = useMemo<ExercisesValue>(
    () => ({
      exercises,
      byId: new Map(exercises.map((e) => [e.id, e])),
      loading,
      error,
      reload,
      create,
      archive,
    }),
    [exercises, loading, error, reload, create, archive],
  );

  return <ExercisesContext.Provider value={value}>{children}</ExercisesContext.Provider>;
}

export function useExercises(): ExercisesValue {
  const ctx = useContext(ExercisesContext);
  if (!ctx) throw new Error('useExercises debe usarse dentro de ExercisesProvider');
  return ctx;
}
