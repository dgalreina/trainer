import { exerciseNameKey, type ExerciseCategory } from '@trainer/shared';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import { useExercises } from '@/lib/exercises';

/** `stacked`: abierto encima de las pestañas (con botón Atrás), no como una de ellas. */
export function ExercisesScreen({ stacked }: { stacked?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const { exercises, loading, error: loadError, reload, create, archive } = useExercises();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      await create(query.trim(), category ?? 'otros');
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido crear el ejercicio');
    } finally {
      setCreating(false);
    }
  }

  async function onArchive(id: string) {
    const exercise = exercises.find((e) => e.id === id);
    if (!exercise) return;
    try {
      await archive(exercise);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido archivar');
    }
  }

  return (
    <Screen
      title="Ejercicios"
      subtitle={`${exercises.length} en tu catálogo`}
      scroll={false}
      stacked={stacked}
      action={
        stacked ? (
          <LinkButton
            title="Atrás"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/entrenamientos'))}
          />
        ) : undefined
      }>
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
          onPress={onCreate}
          loading={creating}
        />
      )}
      <ErrorText message={error ?? loadError} />

      <FlatList
        data={visible}
        keyExtractor={(e) => e.id}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? undefined : (
            <ThemedText themeColor="textSecondary">No hay ejercicios que coincidan.</ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
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
                onPress={() => onArchive(item.id)}
                hitSlop={10}>
                <ThemedText style={{ color: theme.textSecondary }}>✕</ThemedText>
              </Pressable>
            )}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { flexDirection: 'row', gap: Spacing.two },
  list: { gap: Spacing.two, paddingBottom: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1 },
});
