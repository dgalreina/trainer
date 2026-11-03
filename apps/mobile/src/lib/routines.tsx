import type { CreateRoutine, Routine } from '@trainer/shared';
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

interface RoutinesValue {
  routines: Routine[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Crea (sin id) o actualiza (con id) y deja la lista al día. */
  save: (id: string | null, routine: CreateRoutine) => Promise<Routine>;
  remove: (id: string) => Promise<void>;
}

const RoutinesContext = createContext<RoutinesValue | null>(null);

export function RoutinesProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutines(await api.get<Routine[]>('/routines'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar las rutinas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') reload();
    else setRoutines([]);
  }, [status, reload]);

  const save = useCallback(async (id: string | null, routine: CreateRoutine) => {
    const saved = id
      ? await api.patch<Routine>(`/routines/${id}`, routine)
      : await api.post<Routine>('/routines', routine);
    setRoutines((prev) =>
      id ? prev.map((r) => (r.id === id ? saved : r)) : [...prev, saved],
    );
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/routines/${id}`);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo<RoutinesValue>(
    () => ({ routines, loading, error, reload, save, remove }),
    [routines, loading, error, reload, save, remove],
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines(): RoutinesValue {
  const ctx = useContext(RoutinesContext);
  if (!ctx) throw new Error('useRoutines debe usarse dentro de RoutinesProvider');
  return ctx;
}
