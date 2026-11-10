import type { TrainingTemplate } from '@trainer/shared';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Una plantilla de entrenamiento: qué trae y un botón para copiarla a los entrenos propios. */
export function TemplateCard({
  template,
  using,
  disabled,
  onUse,
}: {
  template: TrainingTemplate;
  using: boolean;
  /** Hay otra plantilla copiándose: no se puede usar ninguna hasta que acabe. */
  disabled?: boolean;
  onUse: () => void;
}) {
  return (
    <Card tone="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{template.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {template.routines.length} {template.routines.length === 1 ? 'rutina' : 'rutinas'} · {template.durationWeeks} semanas
      </ThemedText>
      {template.description ? <ThemedText type="small">{template.description}</ThemedText> : null}
      <View style={styles.routines}>
        {template.routines.map((routine, index) => (
          <ThemedText key={index} type="small" themeColor="textSecondary">
            Día {index + 1} · {routine.name || 'Sin nombre'} · {routine.slots.length} ejercicios
          </ThemedText>
        ))}
      </View>
      <Button title="Usar esta plantilla" onPress={onUse} loading={using} disabled={disabled} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  routines: { gap: Spacing.one },
});
