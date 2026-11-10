import { calculateTargets, loggedMacros, sumMacros, type DayEnergy, type MealLog } from '@trainer/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BalanceBar, BalanceLabel } from '@/components/balance-bar';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentDay, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import type { DayEvent } from '@/lib/week-events';

/**
 * Resumen del día, flotando abajo. Cerrado son dos líneas: las calorías y, debajo, cómo vas (déficit,
 * mantenimiento o superávit con su cifra), con una flecha que lo abre; abierto se desglosa en proteínas,
 * hidratos y grasas, el objetivo y el gasto. Siempre debajo, una línea fina de progreso. Cuenta lo
 * registrado y también las comidas de la dieta que siguen en pie ese día: se da por hecho que se comen,
 * salvo que se editen o se quiten.
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
  const theme = useTheme();
  const { dietOn, dayStartMinutes } = useSettings();
  // La dieta que rige ese día (puede no ser la de hoy si se ha cambiado).
  const activeDiet = dietOn(day);
  const { profile, latestWeight, loading } = useMe();
  const [open, setOpen] = useState(false);
  // Hoy y los días futuros no han acabado: el gasto y el balance son una previsión a las 24:00.
  const projected = day >= currentDay(dayStartMinutes);

  const eaten = sumMacros([loggedMacros(logs), ...planned.flatMap((event) => (event.macros ? [event.macros] : []))]);
  const targets = calculateTargets({
    ...profile,
    weightKg: latestWeight?.weightKg ?? null,
    goal: profile.goal ?? activeDiet?.goal ?? 'mantener',
    today: todayISO(),
  });

  return (
    // Compacto: quita el menor espacio posible al calendario.
    <Card tone="primarySoft" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Ocultar el detalle del día' : 'Ver el detalle del día'}
        onPress={() => setOpen((value) => !value)}
        hitSlop={8}
        style={styles.header}>
        <View style={styles.lines}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {eaten.kcal} kcal
          </ThemedText>
          {energy?.hasBurn ? (
            <BalanceLabel balance={energy.totals.balance} burn={energy.totals.burn} projected={projected} />
          ) : null}
        </View>
        {/* La flecha mira a la derecha con el resumen cerrado y hacia abajo con él abierto. */}
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.primaryText}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      </Pressable>

      {open && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Proteínas {eaten.protein} g · Hidratos {eaten.carbs} g · Grasas {eaten.fat} g
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
              {projected ? 'Balance previsto a las 24:00' : 'Balance'}: {energy.totals.balance > 0 ? '+' : ''}
              {energy.totals.balance} kcal
            </ThemedText>
          ) : null}
        </>
      )}

      {/* Sin gasto no hay barra: se dice por qué, también con la tarjeta cerrada. */}
      {!energy?.hasBurn && !loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Completa «Mis datos» (y registra tu peso) para ver el gasto y el balance del día.
        </ThemedText>
      ) : null}

      {energy?.hasBurn ? (
        <BalanceBar balance={energy.totals.balance} burn={energy.totals.burn} projected={projected} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Sombra suave: la tarjeta flota sobre la gráfica y debe despegarse de ella.
  card: { padding: Spacing.two + 4, gap: Spacing.two, ...({ boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)' } as object) },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  lines: { flex: 1, gap: Spacing.half },
});
