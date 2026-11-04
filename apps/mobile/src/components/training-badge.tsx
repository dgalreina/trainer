import { trainingProgress, type Training } from '@trainer/shared';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/lib/dates';
import { progressLabel, progressShort } from '@/lib/training-progress';

const SIZE = 100;
const BORDER = 1.5;
const PADDING = Spacing.two;
/** Ancho útil dentro del círculo. */
const INNER_WIDTH = SIZE - 2 * BORDER - 2 * PADDING;
/**
 * Ancho medio de una letra en negrita, en em. Se toma generoso (la tipografía de iOS es más
 * ancha que la de Windows con la que se prueba): una palabra que no cabe se parte a mitad
 * ("Entrenamient / o"), que es peor que una letra más pequeña.
 */
const BOLD_CHAR_EM = 0.66;
const MAX_FONT = 11;
const MIN_FONT = 8;

/** Tamaño de letra con el que cabe la palabra más larga del nombre sin partirse. */
function nameFontSize(name: string): number {
  const longest = Math.max(1, ...name.split(/\s+/).map((word) => word.length));
  const fit = Math.floor((INNER_WIDTH / (longest * BOLD_CHAR_EM)) * 2) / 2;
  return Math.min(MAX_FONT, Math.max(MIN_FONT, fit));
}

/** Círculo con el entrenamiento actual y la semana en que va. Se toca para abrirlo. */
export function TrainingBadge({ training, onPress }: { training: Training; onPress: () => void }) {
  const theme = useTheme();
  const progress = trainingProgress(training, todayISO());
  const fontSize = nameFontSize(training.name);

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
      <ThemedText
        style={[styles.name, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}
        numberOfLines={3}>
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
    borderWidth: BORDER,
    // Desenfoca lo que hay detrás (las ondas) para que el texto se lea sobre cualquier color.
    // Es una propiedad de la web; en nativo se ignora.
    ...({ backdropFilter: 'blur(10px)' } as object),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PADDING,
    gap: Spacing.half,
  },
  pressed: { opacity: 0.75 },
  // Tipografía pequeña: el nombre puede ocupar hasta tres líneas; su tamaño (`nameFontSize`) se
  // ajusta a la palabra más larga.
  name: { fontWeight: 700, textAlign: 'center' },
  week: { fontSize: 10, lineHeight: 12, fontWeight: 500, textAlign: 'center' },
});
