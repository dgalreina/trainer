import { foodNameKey, type CreateFood, type Food } from '@trainer/shared';
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

const byName = (a: Food, b: Food) => foodNameKey(a.name).localeCompare(foodNameKey(b.name));

interface FoodsValue {
  foods: Food[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (food: CreateFood) => Promise<Food>;
  archive: (food: Food) => Promise<void>;
}

const FoodsContext = createContext<FoodsValue | null>(null);

/** Catálogo de alimentos (base + propios) cargado una vez y compartido por todas las pantallas. */
export function FoodsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFoods(await api.get<Food[]>('/foods'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar los alimentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') reload();
    else setFoods([]);
  }, [status, reload]);

  const create = useCallback(async (food: CreateFood) => {
    const created = await api.post<Food>('/foods', food);
    setFoods((prev) => [...prev, created].sort(byName));
    return created;
  }, []);

  const archive = useCallback(async (food: Food) => {
    await api.delete(`/foods/${food.id}`);
    setFoods((prev) => prev.filter((f) => f.id !== food.id));
  }, []);

  const value = useMemo<FoodsValue>(
    () => ({ foods, loading, error, reload, create, archive }),
    [foods, loading, error, reload, create, archive],
  );

  return <FoodsContext.Provider value={value}>{children}</FoodsContext.Provider>;
}

export function useFoods(): FoodsValue {
  const ctx = useContext(FoodsContext);
  if (!ctx) throw new Error('useFoods debe usarse dentro de FoodsProvider');
  return ctx;
}
