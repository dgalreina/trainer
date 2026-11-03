import { exerciseNameKey, type Exercise, type ExerciseCategory } from '@trainer/shared';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chip, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import { useExercises } from '@/lib/exercises';

/** Selector de ejercicio a pantalla completa, con búsqueda y filtro por categoría. */
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
  const [category, setCategory] = useState<ExerciseCategory | null>(null);

  const key = exerciseNameKey(query);
  const data = useMemo(
    () =>
      exercises.filter(
        (e) =>
          (!category || e.category === category) && (!key || exerciseNameKey(e.name).includes(key)),
      ),
    [exercises, category, key],
  );

  function pick(exercise: Exercise) {
    setQuery('');
    onSelect(exercise);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Añadir ejercicio</ThemedText>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chips}>
              <Chip label="Todos" active={!category} onPress={() => setCategory(null)} />
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={CATEGORY_LABELS[c]}
                  active={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
            </View>
          </ScrollView>

          <FlatList
            data={data}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary">
                No hay ejercicios. Puedes crearlos en la pestaña Ejercicios.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Card onPress={() => pick(item)}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {CATEGORY_LABELS[item.category]}
                </ThemedText>
              </Card>
            )}
          />
        </View>
      </ThemedView>
    </Modal>
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
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  list: { gap: Spacing.two, paddingBottom: Spacing.four },
});
