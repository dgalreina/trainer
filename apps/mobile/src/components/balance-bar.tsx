import { balanceZone, maintenanceBand, type BalanceZone } from '@trainer/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** La barra va, como mucho, de −este balance (vacía) a +este balance (llena); más allá se queda en el extremo. */
const MIN_RANGE = 600;
const TRACK_HEIGHT = 3;
/** Lo mínimo que se llena la barra (fracción): con un déficit enorme el relleno seguiría viéndose, en azul, y no saldría vacía. */
const MIN_FILL = 0.07;
/** Transparencia del carril vacío (hex, ≈ 35 %): solo el fondo, para que el relleno conserve su color pleno. */
const TRACK_ALPHA = '59';

const LABELS: Record<BalanceZone, string> = {
  deficit: 'Déficit',
  maintenance: 'Mantenimiento',
  surplus: 'Superávit',
};

/**
 * Cómo va el día de consumo, discreto: una línea fina vacía (marrón oscuro apagado) que se va llenando de
 * izquierda a derecha según el balance (consumo − gasto): casi vacía con un déficit grande, por la mitad en
 * mantenimiento y llena con un superávit grande. El relleno cambia de color con la zona: azul en déficit,
 * verde azulado en mantenimiento y rojizo en superávit. Debajo, la zona y la cifra en texto: el color solo no
 * basta para quien no distingue los colores.
 */
export function BalanceBar({
  balance,
  burn,
  projected = false,
}: {
  balance: number;
  burn: number;
  /** El día no ha acabado: es lo que saldría a las 24:00 si todo sigue el plan. */
  projected?: boolean;
}) {
  const theme = useTheme();
  const zone = balanceZone(balance, burn);
  const range = Math.max(MIN_RANGE, maintenanceBand(burn) * 3);
  const filled = Math.max(MIN_FILL, (Math.min(Math.max(balance, -range), range) + range) / (2 * range));
  const colors: Record<BalanceZone, string> = {
    deficit: theme.sky,
    maintenance: theme.teal,
    surplus: theme.primaryText,
  };

  return (
    <View
      accessible
      accessibilityLabel={`${LABELS[zone]}${projected ? ' previsto' : ''}: ${balance > 0 ? '+' : ''}${balance} kilocalorías`}
      style={styles.wrapper}>
      <View style={[styles.track, { backgroundColor: theme.text + TRACK_ALPHA }]}>
        <View style={[styles.fill, { width: `${filled * 100}%`, backgroundColor: colors[zone] }]} />
      </View>
      <ThemedText type="small" style={styles.label}>
        <ThemedText type="smallBold">{`${LABELS[zone]}${projected ? ' previsto' : ''}`}</ThemedText>
        {` · ${balance > 0 ? '+' : ''}${balance} kcal`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one + 2 },
  // La parte vacía: un marrón oscuro apagado (el color del texto con transparencia) que no llama la atención.
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: TRACK_HEIGHT / 2 },
  label: { textAlign: 'center' },
});
