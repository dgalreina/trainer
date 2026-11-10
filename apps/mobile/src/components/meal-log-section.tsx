import { calculateTargets, loggedMacros, sumMacros, type DayEnergy, type MealLog } from '@trainer/shared';

import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
  energy,
}: {
  day: string;
  logs: MealLog[];
  /** Comidas de la dieta de ese día que no se han editado ni quitado. */
  planned: DayEvent[];
  /** Gasto, consumo y balance estimados del día, los de las gráficas. */
  energy?: DayEnergy | null;
}) {
  const { dietOn } = useSettings();
  // La dieta que rige ese día (puede no ser la de hoy si se ha cambiado).
  const activeDiet = dietOn(day);
  const { profile, latestWeight, loading } = useMe();
  // Hoy y los días futuros no han acabado: el gasto y el balance son una previsión a las 24:00.
  const projected = day >= todayISO();

  const eaten = sumMacros([loggedMacros(logs), ...planned.flatMap((event) => (event.macros ? [event.macros] : []))]);
  const targets = calculateTargets({
    ...profile,
    weightKg: latestWeight?.weightKg ?? null,
    goal: profile.goal ?? activeDiet?.goal ?? 'mantener',
    today: todayISO(),
  });

  return (
    // Resumen compacto: sin título y con letra pequeña, para quitar el menor espacio posible al calendario.
    <Card tone="primarySoft" style={styles.card}>
      <ThemedText type="smallBold">
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
      {energy?.hasBurn ? (
        <ThemedText type="small" themeColor="textSecondary">
          {projected ? 'Gasto previsto' : 'Gasto estimado'}: {energy.totals.burn} kcal (basal {energy.totals.basal}
          {energy.totals.workouts > 0 ? ` + entrenos ${energy.totals.workouts}` : ''}) ·{' '}
          {projected ? 'Balance previsto a las 24:00' : 'Balance'}:{' '}
          {energy.totals.balance > 0 ? '+' : ''}
          {energy.totals.balance} kcal
        </ThemedText>
      ) : loading ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          Completa «Mis datos» (y registra tu peso) para ver el gasto y el balance del día.
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.two + 4, gap: Spacing.half },
});
