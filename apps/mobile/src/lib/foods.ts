import { foodNameKey, type CreateFood, type Food } from '@trainer/shared';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const byName = (a: Food, b: Food) => foodNameKey(a.name).localeCompare(foodNameKey(b.name));

/** Catálogo de alimentos (base + propios) y sus altas y bajas. */
export function useFoods() {
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

  return { foods, loading, error, reload, create, archive };
}
