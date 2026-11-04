import { loggedMacros, type MealLog, type WeightEntry, type WorkoutSession } from '@trainer/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { addDays, isoOf, startOfDay } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSessionsVersion } from '@/lib/session-events';
import { useTrainings } from '@/lib/trainings';

export type EventKind = 'workout' | 'weight' | 'meal';

/** Algo que pasó en un momento del día: un entreno, una pesada o una comida. */
export interface DayEvent {
  id: string;
  kind: EventKind;
  start: Date;
  end: Date;
  title: string;
  subtitle?: string;
  /** Solo en entrenos: el id de la sesión, para poder moverla. */
  sessionId?: string;
  /** Solo en pesadas: el id, para poder moverla o borrarla. */
  weightId?: string;
  /** Solo en comidas: el id del registro, para poder moverlo. */
  mealId?: string;
}

const MINUTE_MS = 60_000;
/** Duración con la que se dibuja lo que no la tiene (pesadas) o no se registró (entrenos antiguos). */
const POINT_EVENT_MINUTES = 20;
const FALLBACK_WORKOUT_MINUTES = 45;
const MEAL_MINUTES = 30;
/**
 * Se cargan tres semanas (la anterior, la actual y la siguiente): al pasar de día en día, el día
 * de al lado ya está cargado y no hay un parpadeo de "nada registrado" al cruzar de semana.
 */
const WEEKS_BEFORE = 1;
const WEEKS_AFTER = 2;

/** Los eventos de la semana que empieza el lunes `weekStart` y de las dos que la rodean. */
export function useWeekEvents(weekStart: string) {
  const { trainings } = useTrainings();
  const { weightsVersion, updateWeight } = useMe();
  const sessionsVersion = useSessionsVersion();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = startOfDay(addDays(weekStart, -7 * WEEKS_BEFORE)).toISOString();
    const to = startOfDay(addDays(weekStart, 7 * WEEKS_AFTER)).toISOString();
    const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const [s, w, m] = await Promise.all([
        api.get<WorkoutSession[]>(`/sessions?limit=100&${range}`),
        api.get<WeightEntry[]>(`/me/weights?${range}`),
        api.get<MealLog[]>(`/me/meals?${range}`),
      ]);
      setSessions(s);
      setWeights(w);
      setMeals(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load, weightsVersion, sessionsVersion]);

  const events = useMemo<DayEvent[]>(() => {
    const workouts = sessions.map((session): DayEvent => {
      const start = new Date(session.date);
      const minutes = session.durationSeconds ? session.durationSeconds / 60 : FALLBACK_WORKOUT_MINUTES;
      const routine = trainings
        .find((t) => t.id === session.trainingId)
        ?.routines.find((r) => r.id === session.routineId);
      const sets = session.entries.reduce((total, e) => total + e.sets.length, 0);
      const volume = Math.round(
        session.entries.reduce((total, e) => total + e.sets.reduce((v, s) => v + s.reps * s.weightKg, 0), 0),
      );
      return {
        id: `workout-${session.id}`,
        kind: 'workout',
        sessionId: session.id,
        start,
        end: new Date(start.getTime() + minutes * MINUTE_MS),
        title: routine?.name ?? 'Entreno',
        subtitle: `${sets} ${sets === 1 ? 'serie' : 'series'} · ${volume.toLocaleString('es-ES')} kg`,
      };
    });
    const weighIns = weights.map((entry): DayEvent => {
      const start = new Date(entry.date);
      return {
        id: `weight-${entry.id}`,
        kind: 'weight',
        start,
        end: new Date(start.getTime() + POINT_EVENT_MINUTES * MINUTE_MS),
        title: `${entry.weightKg.toLocaleString('es-ES')} kg`,
        weightId: entry.id,
      };
    });
    const eaten = meals.map((meal): DayEvent => {
      const start = new Date(meal.date);
      return {
        id: `meal-${meal.id}`,
        kind: 'meal',
        mealId: meal.id,
        start,
        end: new Date(start.getTime() + MEAL_MINUTES * MINUTE_MS),
        title: meal.name,
        subtitle: `${loggedMacros([meal]).kcal} kcal`,
      };
    });
    return [...workouts, ...weighIns, ...eaten].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [sessions, weights, meals, trainings]);

  /** Eventos del día "AAAA-MM-DD", por hora. */
  const eventsOf = useCallback(
    (day: string) => events.filter((event) => isoOf(event.start) === day),
    [events],
  );

  /** Comidas registradas del día "AAAA-MM-DD", por hora. */
  const mealsOf = useCallback((day: string) => meals.filter((meal) => isoOf(new Date(meal.date)) === day), [meals]);

  /**
   * Cambia la hora de un evento. Se ve el cambio al instante y se guarda en el servidor; si falla,
   * se avisa y se vuelve a cargar lo que hay de verdad.
   */
  const moveEvent = useCallback(
    async (event: DayEvent, newStart: Date) => {
      const date = newStart.toISOString();
      setError(null);
      try {
        if (event.kind === 'weight' && event.weightId) {
          setWeights((prev) => prev.map((w) => (w.id === event.weightId ? { ...w, date } : w)));
          await updateWeight(event.weightId, { date });
        } else if (event.kind === 'meal' && event.mealId) {
          setMeals((prev) => prev.map((m) => (m.id === event.mealId ? { ...m, date } : m)));
          await api.patch(`/me/meals/${event.mealId}`, { date });
        } else if (event.sessionId) {
          setSessions((prev) => prev.map((s) => (s.id === event.sessionId ? { ...s, date } : s)));
          await api.patch(`/sessions/${event.sessionId}`, { date });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se ha podido mover');
        await load();
      }
    },
    [updateWeight, load],
  );

  return { events, eventsOf, mealsOf, loading, error, reload: load, moveEvent };
}
