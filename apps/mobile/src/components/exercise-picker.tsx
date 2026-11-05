import { type Exercise, type ExerciseCategory } from '@trainer/shared';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import { useExercises } from '@/lib/exercises';
import { searchExercises } from '@/lib/exercise-search';

/**
 * Selector de ejercicio a pantalla completa para cuando no te sabes el nombre: los ejercicios
 * separados por grupo muscular, en cuadrícula (más adelante, cada recuadro llevará su imagen).
 */
export function ExercisePicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const { exercises } = useExercises();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const found = query.trim() ? searchExercises(exercises, query, 60) : exercises;
    return CATEGORIES.map((category) => ({
      category,
      items: found.filter((e) => e.category === category),
    })).filter((g) => g.items.length > 0);
  }, [exercises, query]);

  function pick(exercise: Exercise) {
    setQuery('');
    onSelect(exercise);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Elegir ejercicio</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={10}>
              <ThemedText type="linkPrimary">Cerrar</ThemedText>
            </Pressable>
          </View>

          <Field
            label="Buscar"
            value={query}
            onChangeText={setQuery}
            placeholder="Press banca, sentadilla…"
            autoCapitalize="none"
          />

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
            {groups.length === 0 && (
              <ThemedText themeColor="textSecondary">No hay ejercicios con ese nombre.</ThemedText>
            )}
            {groups.map((group) => (
              <Group key={group.category} category={group.category} items={group.items} onPick={pick} />
            ))}
          </ScrollView>
        </View>
      </ThemedView>
    </Modal>
  );
}

function Group({
  category,
  items,
  onPick,
}: {
  category: ExerciseCategory;
  items: Exercise[];
  onPick: (exercise: Exercise) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {CATEGORY_LABELS[category]}
      </ThemedText>
      <View style={styles.grid}>
        {items.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            accessibilityLabel={exercise.name}
            onPress={() => onPick(exercise)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: theme.backgroundElement },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}>
            {/* Aquí irá la imagen del ejercicio. */}
            <ThemedText type="smallBold" numberOfLines={3}>
              {exercise.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.four, paddingBottom: Spacing.five },
  group: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '48.5%',
    minHeight: 84,
    borderRadius: Radius.control,
    padding: Spacing.three,
    justifyContent: 'flex-end',
  },
});
