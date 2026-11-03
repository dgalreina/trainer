import { trainingProgress, type Training } from '@trainer/shared';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/lib/dates';
import { progressLabel, progressShort } from '@/lib/training-progress';

const SIZE = 100;

/** Círculo con el entrenamiento actual y la semana en que va. Se toca para abrirlo. */
export function TrainingBadge({ training, onPress }: { training: Training; onPress: () => void }) {
  const theme = useTheme();
  const progress = trainingProgress(training, todayISO());

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrenamiento actual: ${training.name}. ${progressLabel(training, progress)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        { backgroundColor: theme.glass, borderColor: theme.glassBorder },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.name} numberOfLines={3}>
        {training.name}
      </ThemedText>
      <ThemedText style={styles.week} themeColor="textSecondary" numberOfLines={1}>
        {progressShort(training, progress)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    // Desenfoca lo que hay detrás (las ondas) para que el texto se lea sobre cualquier color.
    // Es una propiedad de la web; en nativo se ignora.
    ...({ backdropFilter: 'blur(10px)' } as object),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    gap: Spacing.half,
  },
  pressed: { opacity: 0.75 },
  // Tipografía pequeña: el nombre puede ocupar hasta tres líneas dentro del círculo.
  name: { fontSize: 11, lineHeight: 13, fontWeight: 700, textAlign: 'center' },
  week: { fontSize: 10, lineHeight: 12, fontWeight: 500, textAlign: 'center' },
});
