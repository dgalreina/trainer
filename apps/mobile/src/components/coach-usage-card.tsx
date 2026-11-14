import type { AiPlan } from '@trainer/shared';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCoach } from '@/lib/coach';

const PLAN_LABEL: Record<AiPlan, string> = { gratis: 'Sin IA', prueba: 'Prueba', pro: 'Pro' };

const number = (n: number) => n.toLocaleString('es-ES');

/** «noviembre de 2026» a partir de «2026-11». */
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/**
 * Cuánta IA se ha usado este mes: tokens frente al tope del plan, mensajes y coste estimado. Sirve para ver el gasto
 * real y ajustar los topes. Los números los calcula el servidor (`GET /coach/usage`).
 */
export function CoachUsageCard() {
  const theme = useTheme();
  const { usage } = useCoach();
  if (!usage) return null;

  const hasAccess = usage.capTokens > 0;
  const share = hasAccess ? Math.min(1, usage.totalTokens / usage.capTokens) : 0;

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold">Uso de la IA</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Plan: {PLAN_LABEL[usage.plan]}
        </ThemedText>
      </View>

      {hasAccess ? (
        <>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: share >= 1 ? theme.amber : theme.teal }]} />
          </View>
          <ThemedText type="small">
            {number(usage.totalTokens)} de {number(usage.capTokens)} tokens en {monthLabel(usage.month)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {usage.calls} {usage.calls === 1 ? 'mensaje' : 'mensajes'} · entrada {number(usage.inputTokens)} · salida{' '}
            {number(usage.outputTokens)} · coste estimado {usage.costEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Tu plan no incluye el entrenador de IA.
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
