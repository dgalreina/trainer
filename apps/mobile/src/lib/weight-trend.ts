import { dayEnergy, weightTrend, type TrendDay, type WeightTrend } from '@trainer/shared';
import { useMemo } from 'react';

import { addDays, isoOf, mondayOf, todayISO } from '@/lib/dates';
import { useEnergyInput } from '@/lib/energy-input';
import { useWeekEvents } from '@/lib/week-events';

/** Cuántas semanas se miran (la actual incluida). */
export const TREND_WEEKS = 12;

/**
 * El análisis del peso frente a las calorías de las últimas semanas (ver `weightTrend`): pide los eventos de esas semanas y calcula
 * el balance de cada día ya terminado con el gasto que hay aplicado. `trend` es null mientras falten los datos del perfil.
 */
export function useWeightTrend(): { trend: WeightTrend | null; bmr: number | null; loading: boolean; error: string | null } {
  const today = todayISO();
  const weekStart = mondayOf(today);
  const { events, eventsOf, plannedOf, isLoaded, loading, error } = useWeekEvents(weekStart, { before: TREND_WEEKS - 1, after: 1 });
  const { energyInput, bmr } = useEnergyInput();

  const trend = useMemo(() => {
    if (bmr === null) return null;
    const firstDay = addDays(weekStart, -7 * (TREND_WEEKS - 1));
    const days: TrendDay[] = [];
    // Hasta ayer: hoy aún no ha acabado.
    for (let day = firstDay; day < today; day = addDays(day, 1)) {
      if (!isLoaded(day)) continue;
      const list = [...eventsOf(day), ...plannedOf(day)];
      const energy = dayEnergy(energyInput(day, list));
      days.push({
        day,
        balance: energy.totals.balance,
        intake: energy.totals.intake,
        burn: energy.totals.burn,
        // Un día sin ninguna comida no es un día de ayuno: no se cuenta.
        counted: energy.totals.intake > 0,
      });
    }
    const weights = events
      .filter((e) => e.kind === 'weight' && e.weightKg !== undefined && isoOf(e.start) >= firstDay)
      .map((e) => ({ day: isoOf(e.start), weightKg: e.weightKg as number }));
    return weightTrend({ weights, days });
  }, [bmr, weekStart, today, isLoaded, eventsOf, plannedOf, energyInput, events]);

  return { trend, bmr, loading, error };
}
