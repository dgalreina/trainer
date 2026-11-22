import { calculateTargets, loggedMacros, stepsKcal } from '@trainer/shared';
import { useCallback } from 'react';

import { startOfDay, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import type { DayEvent } from '@/lib/week-events';

/**
 * Lo que alimenta el cálculo de energía de un día (`dayEnergy`) a partir de sus eventos. El basal sale del perfil
 * (Mifflin-St Jeor, con el último peso y la edad de hoy, también en días pasados) y los entrenos se estiman; lo comido es
 * lo registrado más lo de la dieta que se da por comido. Un entreno en curso no gasta hasta finalizarlo.
 */
export function useEnergyInput() {
  const { profile, latestWeight } = useMe();
  const { settings } = useSettings();
  // Gasto diario extra por moverte y digerir (lo estima «Mi peso» y se aplica desde ahí).
  const extraBurn = settings.extraBurnKcal ?? 0;
  const weightKg = latestWeight?.weightKg ?? null;
  const bmr = calculateTargets({ ...profile, weightKg, goal: profile.goal ?? 'mantener', today: todayISO() })?.bmr ?? null;

  const energyInput = useCallback(
    (day: string, list: DayEvent[]) => ({
      dayStart: startOfDay(day).getTime(),
      bmr,
      weightKg,
      extraBurn,
      // Los pasos del día (acumulados hasta su hora): ese día cuentan ellos en vez de la actividad media.
      steps: (() => {
        const walked = list.find((e) => e.kind === 'steps' && e.steps);
        return walked && weightKg && weightKg > 0
          ? { at: walked.start.getTime(), kcal: stepsKcal(walked.steps ?? 0, weightKg) }
          : undefined;
      })(),
      workouts: list
        .filter((e) => e.kind === 'workout' && !e.inProgress)
        .map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
      meals: list.flatMap((e) =>
        e.kind === 'meal' && e.log
          ? [{ at: e.start.getTime(), kcal: loggedMacros([e.log]).kcal }]
          : e.kind === 'plan' && e.macros
            ? [{ at: e.start.getTime(), kcal: e.macros.kcal }]
            : [],
      ),
    }),
    [bmr, weightKg, extraBurn],
  );

  return { bmr, weightKg, extraBurn, energyInput };
}
