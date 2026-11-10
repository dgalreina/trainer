import { balanceZone, maintenanceBand, type BalanceZone } from '@trainer/shared';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** La barra llega, como mucho, a este balance (kcal) por cada lado; más allá el marcador se queda en el extremo. */
const MIN_RANGE = 600;
const MARKER = 14;

const LABELS: Record<BalanceZone, string> = {
  deficit: 'Déficit',
  maintenance: 'Mantenimiento',
  surplus: 'Superávit',
};

/**
 * Cómo va el día de consumo: una barra con tres zonas (déficit, mantenimiento y superávit) y un marcador
 * donde cae el balance (consumo − gasto), con la zona y la cifra debajo. Azul para el gasto que pesa más,
 * verde azulado para el mantenimiento y salmón para lo que se come de más (los colores de la app).
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
  const band = maintenanceBand(burn);
  const range = Math.max(MIN_RANGE, band * 3);
  const position = (Math.min(Math.max(balance, -range), range) + range) / (2 * range);
  const colors: Record<BalanceZone, string> = {
    deficit: theme.sky,
    maintenance: theme.teal,
    surplus: theme.primary,
  };
  const widths: Record<BalanceZone, number> = {
    deficit: range - band,
    maintenance: 2 * band,
    surplus: range - band,
  };

  return (
    <View
      accessible
      accessibilityLabel={`${LABELS[zone]}${projected ? ' previsto' : ''}: ${balance > 0 ? '+' : ''}${balance} kilocalorías`}
      style={styles.wrapper}>
      <View style={styles.track}>
        {(['deficit', 'maintenance', 'surplus'] as const).map((key) => (
          <View
            key={key}
            style={[
              { flex: widths[key], backgroundColor: colors[key], opacity: key === zone ? 1 : 0.35 },
              // La barra no recorta a sus hijos (el marcador sobresale): las puntas se redondean a mano.
              key === 'deficit' && styles.leftEnd,
              key === 'surplus' && styles.rightEnd,
            ]}
          />
        ))}
        {/* El marcador va encima de la barra: un punto con borde para que se vea sobre cualquier color. */}
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            { left: `${position * 100}%`, backgroundColor: theme.background, borderColor: colors[zone] },
          ]}
        />
      </View>
      <ThemedText type="small" style={styles.label}>
        <ThemedText type="smallBold">{`${LABELS[zone]}${projected ? ' previsto' : ''}`}</ThemedText>
        {` · ${balance > 0 ? '+' : ''}${balance} kcal`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  // Sin `overflow: hidden` en la barra: el marcador sobresale por arriba y por abajo.
  track: { flexDirection: 'row', height: 8, borderRadius: 4, marginVertical: (MARKER - 8) / 2 },
  marker: {
    position: 'absolute',
    top: -(MARKER - 8) / 2,
    width: MARKER,
    height: MARKER,
    marginLeft: -MARKER / 2,
    borderRadius: MARKER / 2,
    borderWidth: 3,
  },
  leftEnd: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  rightEnd: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  label: { textAlign: 'center' },
});
