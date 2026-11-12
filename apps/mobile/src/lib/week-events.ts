import {
  loggedMacros,
  mealMacros,
  routineTitle,
  type Macros,
  type Meal,
  type MealItem,
  type MealLog,
  type WeightEntry,
  type WorkoutSession,
} from '@trainer/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { getItem, setItem } from '@/lib/storage';
import { notifySessionsChanged } from '@/lib/session-events';
import { draftKey, parseDraft, type WorkoutDraft } from '@/lib/workout-draft';
import { addDays, isoOf, startOfDay } from '@/lib/dates';
import { useFoods } from '@/lib/foods';
import { useMe } from '@/lib/me';
import { useSessionsVersion } from '@/lib/session-events';
import { useSettings } from '@/lib/settings';
import { useTrainings } from '@/lib/trainings';

export type EventKind = 'workout' | 'weight' | 'meal' | 'plan';

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
  /** Solo en pesadas: los kilos, para poder editarla. */
  weightKg?: number;
  /** Solo en comidas: el id del registro, para poder moverlo. */
  mealId?: string;
  /** Solo en comidas registradas: el registro entero, para poder editarlo. */
  log?: MealLog;
  /** Solo en comidas de la dieta que siguen en pie ese día: de qué dieta y cuál es, y sus macros. */
  plan?: { dietId: string; meal: Meal };
  macros?: Macros;
  /** Entreno empezado y aún sin finalizar: su hora de inicio vive en el borrador del dispositivo. */
  inProgress?: boolean;
  /** Solo en entrenos en curso: de qué entrenamiento y rutina es el borrador. */
  draftOf?: { trainingId: string; routineId: string };
}

/** Hora "HH:MM" de un día "AAAA-MM-DD", en la hora del dispositivo. */
function atTime(day: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const date = startOfDay(day);
  date.setHours(h, m, 0, 0);
  return date;
}

const MINUTE_MS = 60_000;
/** Duración con la que se dibuja lo que no la tiene (pesadas) o no se registró (entrenos antiguos). */
const POINT_EVENT_MINUTES = 20;
const FALLBACK_WORKOUT_MINUTES = 45;
const MEAL_MINUTES = 30;
/**
 * Se cargan cinco semanas alrededor de la del día que se muestra (dos antes y tres después): con el scroll
 * continuo, los días de los lados ya están cargados y no hay un parpadeo de "nada registrado"; al pasar a
 * otra semana se recarga la ventana.
 */
const WEEKS_BEFORE = 2;
const WEEKS_AFTER = 3;

/** Los eventos de la semana que empieza el lunes `weekStart` y de las dos que la rodean. */
export function useWeekEvents(weekStart: string, span: { before: number; after: number } = { before: WEEKS_BEFORE, after: WEEKS_AFTER }) {
  const { trainings } = useTrainings();
  const { dietOn } = useSettings();
  const { foods } = useFoods();
  const { weightsVersion, updateWeight } = useMe();
  const sessionsVersion = useSessionsVersion();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Qué días cubren los datos que hay (de "from" incluido a "to" excluido): fuera de ahí no se sabe qué hay.
  const [loaded, setLoaded] = useState<{ from: string; to: string } | null>(null);
  // Cada carga lleva un número: si llega la respuesta de una vieja cuando ya hay otra en marcha, se descarta.
  const request = useRef(0);
  const [inProgress, setInProgress] = useState<DayEvent[]>([]);

  // Un entreno solo entra en el calendario cuando se pulsa «Comenzar»: mientras no se finaliza, es
  // un borrador en el dispositivo; se busca el de cada rutina.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: DayEvent[] = [];
      for (const training of trainings) {
        for (const routine of training.routines) {
          const raw = await getItem(draftKey(training.id, routine.id));
          if (!raw) continue;
          try {
            const draft = JSON.parse(raw) as WorkoutDraft;
            if (draft.startedAt === null) continue;
            const start = new Date(draft.startedAt);
            found.push({
              id: `draft-${training.id}-${routine.id}`,
              kind: 'workout',
              inProgress: true,
              draftOf: { trainingId: training.id, routineId: routine.id },
              start,
              end: new Date(start.getTime() + FALLBACK_WORKOUT_MINUTES * MINUTE_MS),
              title: routineTitle(training.routines, routine.id),
              subtitle: 'En curso',
            });
          } catch {
            // Borrador ilegible: se ignora.
          }
        }
      }
      if (!cancelled) setInProgress(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [trainings, sessionsVersion]);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setError(null);
    const fromDay = addDays(weekStart, -7 * span.before);
    const toDay = addDays(weekStart, 7 * span.after);
    const from = startOfDay(fromDay).toISOString();
    const to = startOfDay(toDay).toISOString();
    const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const [s, w, m] = await Promise.all([
        api.get<WorkoutSession[]>(`/sessions?limit=100&${range}`),
        api.get<WeightEntry[]>(`/me/weights?${range}`),
        api.get<MealLog[]>(`/me/meals?${range}`),
      ]);
      if (mine !== request.current) return;
      setSessions(s);
      setWeights(w);
      setMeals(m);
      setLoaded({ from: fromDay, to: toDay });
    } catch (err) {
      if (mine !== request.current) return;
      setError(err instanceof Error ? err.message : 'No se ha podido cargar el calendario');
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [weekStart, span.before, span.after]);

  /** ¿Hay datos cargados de ese día? Fuera de la ventana no se sabe qué hay, y no hay que decir que está vacío. */
  const isLoaded = useCallback(
    (day: string) => loaded !== null && day >= loaded.from && day < loaded.to,
    [loaded],
  );

  useEffect(() => {
    load();
  }, [load, weightsVersion, sessionsVersion]);

  const events = useMemo<DayEvent[]>(() => {
    const workouts = sessions.map((session): DayEvent => {
      const start = new Date(session.date);
      const minutes = session.durationSeconds ? session.durationSeconds / 60 : FALLBACK_WORKOUT_MINUTES;
      const routineOf = trainings.find((t) => t.id === session.trainingId);
      const routine = routineOf?.routines.find((r) => r.id === session.routineId);
      return {
        id: `workout-${session.id}`,
        kind: 'workout',
        sessionId: session.id,
        start,
        end: new Date(start.getTime() + minutes * MINUTE_MS),
        title: routineOf && routine ? routineTitle(routineOf.routines, routine.id) : 'Entreno',
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
        weightKg: entry.weightKg,
      };
    });
    // Las comidas de la dieta descartadas ese día no se muestran (solo evitan que reaparezcan).
    const eaten = meals.filter((meal) => !meal.skipped).map((meal): DayEvent => {
      const start = new Date(meal.date);
      return {
        id: `meal-${meal.id}`,
        kind: 'meal',
        mealId: meal.id,
        log: meal,
        start,
        end: new Date(start.getTime() + MEAL_MINUTES * MINUTE_MS),
        title: meal.name,
        subtitle: `${loggedMacros([meal]).kcal} kcal`,
      };
    });
    return [...workouts, ...inProgress, ...weighIns, ...eaten].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [sessions, weights, meals, trainings, inProgress]);

  /** ¿Cae ese momento en el día "AAAA-MM-DD"? */
  const inDay = useCallback((moment: Date, day: string) => isoOf(moment) === day, []);

  /** Eventos del día "AAAA-MM-DD", por hora. */
  const eventsOf = useCallback(
    (day: string) => events.filter((event) => inDay(event.start, day)),
    [events, inDay],
  );

  /**
   * Las comidas que toca hacer el día "AAAA-MM-DD" según la dieta que rige ese día: desde que se
   * activó y sin fin hasta que se cambia o se quita. Se da por hecho que se comen (cuentan en el
   * recuento) mientras ese día no se hayan editado, movido o quitado: en cuanto se toca una, deja de
   * ser una comida de la dieta y pasa a ser una comida registrada de ese día (la dieta no cambia).
   */
  // El catálogo por id, una sola vez (y no en cada día que se pinta).
  const foodsById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const plannedOf = useCallback(
    (day: string): DayEvent[] => {
      const diet = dietOn(day);
      if (!diet) return [];
      // Las de la dieta que ese día ya tienen su propia versión (editada, movida o quitada).
      const touched = new Set(
        meals.filter((m) => m.dietMealId && inDay(new Date(m.date), day)).map((m) => m.dietMealId),
      );
      return diet.meals
        .filter((meal) => !touched.has(meal.id))
        .map((meal): DayEvent => {
          const start = atTime(day, meal.time);
          // Hasta que carga el catálogo de alimentos no hay macros que calcular.
          const macros = foods.length > 0 ? mealMacros(meal, foodsById) : undefined;
          return {
            id: `plan-${diet.id}-${meal.id}-${day}`,
            kind: 'plan',
            plan: { dietId: diet.id, meal },
            macros,
            start,
            end: new Date(start.getTime() + MEAL_MINUTES * MINUTE_MS),
            title: meal.name,
            subtitle: macros ? `${macros.kcal} kcal` : undefined,
          };
        });
    },
    [dietOn, foodsById, foods.length, meals, inDay],
  );

  /** Comidas registradas del día "AAAA-MM-DD", por hora (sin las de la dieta descartadas ese día). */
  const mealsOf = useCallback(
    (day: string) => meals.filter((meal) => !meal.skipped && inDay(new Date(meal.date), day)),
    [meals, inDay],
  );

  /**
   * Guarda una comida de un día. Sin `target`, es una comida nueva. Si `target` es una comida
   * registrada, se edita esa. Si es una comida de la dieta, se crea la versión de ese día enlazada a
   * ella: la plantilla de la dieta no se toca.
   */
  const saveMeal = useCallback(
    async (target: DayEvent | null, draft: { name: string; date: Date; items: MealItem[] }) => {
      const body = { date: draft.date.toISOString(), name: draft.name, items: draft.items };
      if (target?.kind === 'meal' && target.mealId) {
        await api.patch(`/me/meals/${target.mealId}`, body);
      } else {
        await api.post('/me/meals', { ...body, ...(target?.plan ? { dietMealId: target.plan.meal.id } : {}) });
      }
      await load();
    },
    [load],
  );

  /**
   * Quita una comida de ese día. Una registrada se borra, salvo que viniera de la dieta: entonces
   * se marca como descartada para que no reaparezca. Una de la dieta se descarta solo ese día.
   */
  const removeMeal = useCallback(
    async (target: DayEvent) => {
      if (target.kind === 'meal' && target.log && !target.log.dietMealId) {
        await api.delete(`/me/meals/${target.log.id}`);
      } else if (target.kind === 'meal' && target.log) {
        await api.patch(`/me/meals/${target.log.id}`, { skipped: true });
      } else if (target.plan) {
        await api.post('/me/meals', {
          date: target.start.toISOString(),
          name: target.plan.meal.name,
          items: [],
          dietMealId: target.plan.meal.id,
          skipped: true,
        });
      }
      await load();
    },
    [load],
  );

  /**
   * Cambia la hora de un evento. Se ve el cambio al instante y se guarda en el servidor; si falla,
   * se avisa y se vuelve a cargar lo que hay de verdad.
   */
  const moveEvent = useCallback(
    async (event: DayEvent, newStart: Date) => {
      const date = newStart.toISOString();
      const sameDay = isoOf(newStart) === isoOf(event.start);
      setError(null);
      try {
        if (event.kind === 'weight' && event.weightId) {
          setWeights((prev) => prev.map((w) => (w.id === event.weightId ? { ...w, date } : w)));
          await updateWeight(event.weightId, { date });
        } else if (event.kind === 'meal' && event.mealId && event.log?.dietMealId && !sameDay) {
          // Una comida de la dieta (ya tocada ese día) que cambia de día: ese día queda como descartada, para que la de la
          // dieta no reaparezca, y en el nuevo se registra como una comida normal (si no, taparía la que la dieta ya tenga allí).
          await api.patch(`/me/meals/${event.mealId}`, { skipped: true });
          await api.post('/me/meals', {
            date,
            name: event.title,
            items: event.log.items.map(({ foodId, grams }) => ({ foodId, grams })),
          });
          await load();
        } else if (event.kind === 'meal' && event.mealId) {
          setMeals((prev) => prev.map((m) => (m.id === event.mealId ? { ...m, date } : m)));
          await api.patch(`/me/meals/${event.mealId}`, { date });
        } else if (event.kind === 'plan' && event.plan) {
          const items = event.plan.meal.items.map(({ foodId, grams }) => ({ foodId, grams }));
          if (sameDay) {
            // Mover una comida de la dieta crea la versión de ese día a la nueva hora; la dieta no cambia.
            await api.post('/me/meals', { date, name: event.plan.meal.name, items, dietMealId: event.plan.meal.id });
          } else {
            // A otro día: aquí se descarta (la dieta no cambia) y en el nuevo es una comida normal.
            await api.post('/me/meals', {
              date: event.start.toISOString(),
              name: event.plan.meal.name,
              items: [],
              dietMealId: event.plan.meal.id,
              skipped: true,
            });
            await api.post('/me/meals', { date, name: event.plan.meal.name, items });
          }
          await load();
        } else if (event.inProgress && event.draftOf) {
          // El entreno en curso aún no está guardado: se corrige la hora de inicio de su borrador.
          const key = draftKey(event.draftOf.trainingId, event.draftOf.routineId);
          const draft = parseDraft(await getItem(key));
          if (draft) {
            await setItem(key, JSON.stringify({ ...draft, startedAt: newStart.getTime() }));
            setInProgress((prev) =>
              prev.map((e) =>
                e.id === event.id
                  ? { ...e, start: newStart, end: new Date(newStart.getTime() + FALLBACK_WORKOUT_MINUTES * MINUTE_MS) }
                  : e,
              ),
            );
            // Si el entreno está abierto, también cambia allí.
            notifySessionsChanged();
          }
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

  return { events, eventsOf, plannedOf, mealsOf, isLoaded, saveMeal, removeMeal, loading, error, reload: load, moveEvent };
}
