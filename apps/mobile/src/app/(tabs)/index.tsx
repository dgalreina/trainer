import { exerciseNameKey, type Exercise, type ExerciseCategory } from '@trainer/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field, PRIMARY } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';

export default function ExercisesScreen() {
  const theme = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExercises(await api.get<Exercise[]>('/exercises'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido cargar los ejercicios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const key = exerciseNameKey(query);
  const visible = useMemo(
    () =>
      exercises.filter(
        (e) =>
          (!category || e.category === category) && (!key || exerciseNameKey(e.name).includes(key)),
      ),
    [exercises, category, key],
  );
  // Misma comparación que el servidor: si ya existe, no se ofrece crearlo.
  const canCreate = key.length > 0 && !exercises.some((e) => exerciseNameKey(e.name) === key);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const created = await api.post<Exercise>('/exercises', {
        name: query.trim(),
        category: category ?? 'otros',
      });
      setExercises((prev) =>
        [...prev, created].sort((a, b) => exerciseNameKey(a.name).localeCompare(exerciseNameKey(b.name))),
      );
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido crear el ejercicio');
    } finally {
      setCreating(false);
    }
  }

  async function archive(exercise: Exercise) {
    try {
      await api.delete(`/exercises/${exercise.id}`);
      setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido archivar');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Ejercicios</ThemedText>

        <Field
          label="Buscar o crear"
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

        {canCreate && (
          <Button
            title={`Crear «${query.trim()}» en ${CATEGORY_LABELS[category ?? 'otros']}`}
            onPress={create}
            loading={creating}
          />
        )}
        <ErrorText message={error} />

        <FlatList
          data={visible}
          keyExtractor={(e) => e.id}
          refreshing={loading}
          onRefresh={load}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? undefined : (
              <ThemedText themeColor="textSecondary">No hay ejercicios que coincidan.</ThemedText>
            )
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {CATEGORY_LABELS[item.category]}
                  {item.ownerId ? ' · tuyo' : ''}
                </ThemedText>
              </View>
              {item.ownerId && (
                <Pressable
                  accessibilityLabel={`Archivar ${item.name}`}
                  onPress={() => archive(item)}
                  hitSlop={10}>
                  <ThemedText style={{ color: theme.textSecondary }}>✕</ThemedText>
                </Pressable>
              )}
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? PRIMARY : theme.backgroundElement }]}>
      <ThemedText type="small" style={active ? styles.chipActiveText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    // En la web la barra de pestañas va arriba, superpuesta.
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.four,
    gap: Spacing.three,
  },
  chipScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  chipActiveText: { color: '#ffffff' },
  list: { gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  rowText: { flex: 1 },
});
