import type {
  CreateRoutine,
  CreateTraining,
  Training,
  TrainingTemplate,
  UpdateRoutine,
  UpdateTraining,
} from '@trainer/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface TrainingsValue {
  trainings: Training[];
  /** Plantillas de entrenamiento (compartidas por todos), cargadas una vez. */
  templates: TrainingTemplate[];
  /** Si falló la carga de las plantillas (hasta que se reintente con éxito). */
  templatesError: boolean;
  /** Vuelve a pedir las plantillas. */
  reloadTemplates: () => Promise<void>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Vuelve a pedir la lista al servidor sin mostrar la carga (por si cambió desde otro dispositivo). */
  refresh: () => Promise<void>;
  /** Copia una plantilla a «Mis entrenos», empezando en `startDate`, y devuelve el entrenamiento creado. */
  applyTemplate: (templateId: string, startDate: string) => Promise<Training>;
  create: (training: CreateTraining) => Promise<Training>;
  update: (id: string, changes: UpdateTraining) => Promise<Training>;
  remove: (id: string) => Promise<void>;
  /** Las rutinas solo viven dentro de un entrenamiento; cada operación devuelve este, ya al día. */
  addRoutine: (trainingId: string, routine: CreateRoutine) => Promise<Training>;
  updateRoutine: (trainingId: string, routineId: string, changes: UpdateRoutine) => Promise<Training>;
  removeRoutine: (trainingId: string, routineId: string) => Promise<Training>;
}

const TrainingsContext = createContext<TrainingsValue | null>(null);

export function TrainingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Una sola petición de la lista a la vez: si ya hay una en vuelo, quien la pida espera a esa.
  const inflight = useRef<Promise<Training[]> | null>(null);
  const fetchAll = useCallback(() => {
    inflight.current ??= api.get<Training[]>('/trainings').finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainings(await fetchAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar los entrenamientos');
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    try {
      setTrainings(await fetchAll());
    } catch {
      // Se queda con lo que ya hay; no es un error que mostrar.
    }
  }, [fetchAll]);

  useEffect(() => {
    if (status === 'signedIn') reload();
    else setTrainings([]);
  }, [status, reload]);

  // Las plantillas no cambian desde la app: se piden una vez al entrar (y de nuevo si falló y se reintenta).
  const reloadTemplates = useCallback(async () => {
    try {
      setTemplates(await api.get<TrainingTemplate[]>('/training-templates'));
      setTemplatesError(false);
    } catch {
      setTemplatesError(true);
    }
  }, []);
  useEffect(() => {
    if (status === 'signedIn') reloadTemplates();
    else {
      setTemplates([]);
      setTemplatesError(false);
    }
  }, [status, reloadTemplates]);

  const replace = useCallback((saved: Training) => {
    setTrainings((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    return saved;
  }, []);

  const create = useCallback(async (training: CreateTraining) => {
    const saved = await api.post<Training>('/trainings', training);
    // Más reciente primero, como en el servidor.
    setTrainings((prev) => [saved, ...prev].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    return saved;
  }, []);

  const applyTemplate = useCallback(async (templateId: string, startDate: string) => {
    const saved = await api.post<Training>(`/training-templates/${templateId}/use`, { startDate });
    setTrainings((prev) => [saved, ...prev].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    return saved;
  }, []);

  const update = useCallback(
    async (id: string, changes: UpdateTraining) =>
      replace(await api.patch<Training>(`/trainings/${id}`, changes)),
    [replace],
  );

  const remove = useCallback(async (id: string) => {
    await api.delete(`/trainings/${id}`);
    setTrainings((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addRoutine = useCallback(
    async (trainingId: string, routine: CreateRoutine) =>
      replace(await api.post<Training>(`/trainings/${trainingId}/routines`, routine)),
    [replace],
  );

  const updateRoutine = useCallback(
    async (trainingId: string, routineId: string, changes: UpdateRoutine) =>
      replace(await api.patch<Training>(`/trainings/${trainingId}/routines/${routineId}`, changes)),
    [replace],
  );

  const removeRoutine = useCallback(
    async (trainingId: string, routineId: string) => {
      return replace(await api.delete<Training>(`/trainings/${trainingId}/routines/${routineId}`));
    },
    [replace],
  );

  const value = useMemo<TrainingsValue>(
    () => ({ trainings, templates, templatesError, reloadTemplates, loading, error, reload, refresh, applyTemplate, create, update, remove, addRoutine, updateRoutine, removeRoutine }),
    [trainings, templates, templatesError, reloadTemplates, loading, error, reload, refresh, applyTemplate, create, update, remove, addRoutine, updateRoutine, removeRoutine],
  );

  return <TrainingsContext.Provider value={value}>{children}</TrainingsContext.Provider>;
}

export function useTrainings(): TrainingsValue {
  const ctx = useContext(TrainingsContext);
  if (!ctx) throw new Error('useTrainings debe usarse dentro de TrainingsProvider');
  return ctx;
}
