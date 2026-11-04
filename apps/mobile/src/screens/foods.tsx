import { createFoodSchema, foodNameKey, type FoodCategory } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FOOD_CATEGORY_LABELS, FOOD_CATEGORY_LIST } from '@/lib/food-labels';
import { useFoods } from '@/lib/foods';

const FORM_FIELDS = [
  { key: 'name', label: 'Nombre', numeric: false },
  { key: 'kcal', label: 'Calorías (kcal)', numeric: true },
  { key: 'protein', label: 'Proteína (g)', numeric: true },
  { key: 'carbs', label: 'Hidratos (g)', numeric: true },
  { key: 'fat', label: 'Grasa (g)', numeric: true },
] as const;

const toNumber = (text: string) => Number(text.replace(',', '.').trim() || 'NaN');

/** Catálogo de alimentos con sus macros por 100 g. Se pueden añadir alimentos propios. */
export function FoodsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { foods, loading, error: loadError, reload, create, archive } = useFoods();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });

  const key = foodNameKey(query);
  const visible = useMemo(
    () =>
      foods.filter(
        (f) => (!category || f.category === category) && (!key || foodNameKey(f.name).includes(key)),
      ),
    [foods, category, key],
  );

  function openForm() {
    setForm({ name: query.trim(), kcal: '', protein: '', carbs: '', fat: '' });
    setError(null);
    setAdding(true);
  }

  async function onSave() {
    const parsed = createFoodSchema.safeParse({
      name: form.name,
      category: category ?? 'otros',
      kcal: toNumber(form.kcal),
      protein: toNumber(form.protein),
      carbs: toNumber(form.carbs),
      fat: toNumber(form.fat),
    });
    if (!parsed.success) {
      setError('Revisa el nombre y los números: kcal y macros por 100 g, sin pasarse de 100 g.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await create(parsed.data);
      setAdding(false);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido crear el alimento');
    } finally {
      setSaving(false);
    }
  }

  const set = (field: keyof typeof form) => (text: string) =>
    setForm((prev) => ({ ...prev, [field]: text }));

  return (
    <Screen
      title="Alimentos"
      scroll={false}
      stacked
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/dieta'))}>
      <Field
        label="Buscar"
        accessibilityLabel="Buscar"
        value={query}
        onChangeText={setQuery}
        placeholder="Pollo, arroz, plátano…"
        autoCapitalize="none"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chips}>
          <Chip label="Todos" active={!category} onPress={() => setCategory(null)} />
          {FOOD_CATEGORY_LIST.map((c) => (
            <Chip
              key={c}
              label={FOOD_CATEGORY_LABELS[c]}
              active={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          ))}
        </View>
      </ScrollView>

      <ErrorText message={adding ? null : (error ?? loadError)} />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={visible}
        keyExtractor={(f) => f.id}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          adding ? (
            <Card style={styles.form}>
              <ThemedText type="smallBold">Alimento propio (valores por 100 g)</ThemedText>
              {FORM_FIELDS.map(({ key: field, label, numeric }) => (
                <Field
                  key={field}
                  label={label}
                  accessibilityLabel={label}
                  value={form[field]}
                  onChangeText={set(field)}
                  keyboardType={numeric ? 'decimal-pad' : 'default'}
                  // La tarjeta ya es del color de los campos: se oscurecen un punto para verse.
                  style={{ backgroundColor: theme.backgroundSelected }}
                />
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Categoría: {FOOD_CATEGORY_LABELS[category ?? 'otros']} (la que tengas marcada arriba).
              </ThemedText>
              <ErrorText message={error} />
              <Button title="Guardar alimento" onPress={onSave} loading={saving} />
              <LinkButton title="Cancelar" onPress={() => setAdding(false)} centered />
            </Card>
          ) : (
            <Button title="+ Crear alimento propio" variant="secondary" onPress={openForm} />
          )
        }
        ListEmptyComponent={
          loading ? undefined : (
            <ThemedText themeColor="textSecondary">No hay alimentos que coincidan.</ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.kcal} kcal · P {item.protein} · H {item.carbs} · G {item.fat} (100 g)
                {item.ownerId ? ' · tuyo' : ''}
              </ThemedText>
            </View>
            {item.ownerId && (
              <Pressable
                accessibilityLabel={`Archivar ${item.name}`}
                onPress={() =>
                  archive(item).catch((err) =>
                    setError(err instanceof Error ? err.message : 'No se ha podido archivar'),
                  )
                }
                hitSlop={10}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>✕</ThemedText>
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
  form: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1 },
});
