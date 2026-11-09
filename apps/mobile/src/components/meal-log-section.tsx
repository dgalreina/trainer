import { calculateTargets, loggedMacros, sumMacros, type MealLog } from '@trainer/shared';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import type { DayEvent } from '@/lib/week-events';

/**
 * Lo comido en el día frente al objetivo. Cuenta lo registrado y también las comidas de la dieta
 * que siguen en pie ese día: se da por hecho que se comen, salvo que se editen o se quiten.
 */
export function MealLogSection({
  day,
  logs,
  planned,
}: {
  day: string;
  logs: MealLog[];
  /** Comidas de la dieta de ese día que no se han editado ni quitado. */
  planned: DayEvent[];
}) {
  const { dietOn } = useSettings();
  // La dieta que rige ese día (puede no ser la de hoy si se ha cambiado).
  const activeDiet = dietOn(day);
  const { profile, latestWeight } = useMe();

  const eaten = sumMacros([loggedMacros(logs), ...planned.flatMap((event) => (event.macros ? [event.macros] : []))]);
  const targets = calculateTargets({
    ...profile,
    weightKg: latestWeight?.weightKg ?? null,
    goal: profile.goal ?? activeDiet?.goal ?? 'mantener',
    today: todayISO(),
  });

  return (
    <Card tone="primarySoft">
      <ThemedText type="smallBold">Comido este día</ThemedText>
      <ThemedText>
        {eaten.kcal} kcal · P {eaten.protein} · H {eaten.carbs} · G {eaten.fat}
      </ThemedText>
      {targets ? (
        <ThemedText type="small" themeColor="textSecondary">
          Objetivo: {targets.kcal} kcal ·{' '}
          {eaten.kcal <= targets.kcal
            ? `te quedan ${targets.kcal - eaten.kcal}`
            : `te pasas ${eaten.kcal - targets.kcal}`}
        </ThemedText>
      ) : null}
    </Card>
  );
}
