import type { WorkoutSession } from '@trainer/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { useSessionsVersion } from '@/lib/session-events';

const PAGE = 100;
/** Tope de páginas (1000 entrenos): más de lo que cabe en años de gimnasio, y evita un bucle si algo falla. */
const MAX_PAGES = 10;

/** Todos los entrenos terminados, del más reciente al más antiguo (pide de 100 en 100). Se recarga al guardar uno. */
export function useAllSessions() {
  const version = useSessionsVersion();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cada carga lleva un número: la respuesta de una vieja no pisa a la nueva.
  const request = useRef(0);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const all: WorkoutSession[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const before = all.length > 0 ? `&to=${encodeURIComponent(all[all.length - 1].date)}` : '';
        const chunk = await api.get<WorkoutSession[]>(`/sessions?limit=${PAGE}${before}`);
        if (mine !== request.current) return;
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
      setSessions(all);
    } catch (err) {
      if (mine !== request.current) return;
      setError(err instanceof Error ? err.message : 'No se han podido cargar los entrenos');
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  return { sessions, loading, error, reload: load };
}
