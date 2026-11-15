import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** La marca entre dos ejercicios encadenados: un eslabón y «SUPERSERIE» (como en zitytraining). */
export function SupersetMark() {
  const theme = useTheme();
  return (
    <View style={styles.mark} accessibilityLabel="Superserie con el siguiente ejercicio">
      <View style={styles.link}>
        <View style={[styles.ring, styles.ringLeft, { borderColor: theme.primaryText }]} />
        <View style={[styles.ring, styles.ringRight, { borderColor: theme.primaryText }]} />
      </View>
      <ThemedText type="small" themeColor="primaryText" style={styles.text}>
        SUPERSERIE
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, paddingVertical: Spacing.one + 2 },
  link: { width: 16, height: 10 },
  ring: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  ringLeft: { left: 0 },
  ringRight: { right: 0 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
