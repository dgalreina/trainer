import type { CreateDiet, CreateMeal, Diet, UpdateDiet, UpdateMeal } from '@trainer/shared';
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

interface DietsValue {
  diets: Diet[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (diet: CreateDiet) => Promise<Diet>;
  update: (id: string, changes: UpdateDiet) => Promise<Diet>;
  remove: (id: string) => Promise<void>;
  /** Las comidas solo viven dentro de una dieta; cada operación devuelve esta, ya al día. */
  addMeal: (dietId: string, meal: CreateMeal) => Promise<Diet>;
  updateMeal: (dietId: string, mealId: string, changes: UpdateMeal) => Promise<Diet>;
  removeMeal: (dietId: string, mealId: string) => Promise<Diet>;
}

const DietsContext = createContext<DietsValue | null>(null);

export function DietsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [diets, setDiets] = useState<Diet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDiets(await api.get<Diet[]>('/diets'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar las dietas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') reload();
    else setDiets([]);
  }, [status, reload]);

  const replace = useCallback((saved: Diet) => {
    setDiets((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
    return saved;
  }, []);

  const create = useCallback(async (diet: CreateDiet) => {
    const saved = await api.post<Diet>('/diets', diet);
    // Más reciente primero, como en el servidor.
    setDiets((prev) => [saved, ...prev].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    return saved;
  }, []);

  const update = useCallback(
    async (id: string, changes: UpdateDiet) => replace(await api.patch<Diet>(`/diets/${id}`, changes)),
    [replace],
  );

  const remove = useCallback(async (id: string) => {
    await api.delete(`/diets/${id}`);
    setDiets((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addMeal = useCallback(
    async (dietId: string, meal: CreateMeal) =>
      replace(await api.post<Diet>(`/diets/${dietId}/meals`, meal)),
    [replace],
  );

  const updateMeal = useCallback(
    async (dietId: string, mealId: string, changes: UpdateMeal) =>
      replace(await api.patch<Diet>(`/diets/${dietId}/meals/${mealId}`, changes)),
    [replace],
  );

  const removeMeal = useCallback(
    async (dietId: string, mealId: string) =>
      replace(await api.delete<Diet>(`/diets/${dietId}/meals/${mealId}`)),
    [replace],
  );

  const value = useMemo<DietsValue>(
    () => ({ diets, loading, error, reload, create, update, remove, addMeal, updateMeal, removeMeal }),
    [diets, loading, error, reload, create, update, remove, addMeal, updateMeal, removeMeal],
  );

  return <DietsContext.Provider value={value}>{children}</DietsContext.Provider>;
}

export function useDiets(): DietsValue {
  const ctx = useContext(DietsContext);
  if (!ctx) throw new Error('useDiets debe usarse dentro de DietsProvider');
  return ctx;
}
