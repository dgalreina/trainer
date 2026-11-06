import {
  foodMacros,
  foodNameKey,
  mealMacros,
  type Food,
  type Meal,
  type UpdateMeal,
} from '@trainer/shared';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_RESULTS = 8;

const toNumber = (text: string) => Number(text.replace(',', '.').trim() || 'NaN');

/** Una comida de la dieta: hora, nombre, sus alimentos con gramos y lo que suman. */
export function MealCard({
  meal,
  foods,
  byId,
  onChange,
  onRemove,
}: {
  meal: Meal;
  foods: Food[];
  byId: Map<string, Food>;
  onChange: (changes: UpdateMeal) => Promise<void>;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(meal.name);
  const [time, setTime] = useState(meal.time);
  const [error, setError] = useState<string | null>(null);

  const total = mealMacros(meal, byId);

  async function run(changes: UpdateMeal) {
    setError(null);
    try {
      await onChange(changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar');
      throw err;
    }
  }

  // Nombre y hora se guardan solos al dejar de tocarlos, sin botón.
  useEffect(() => {
    const trimmed = name.trim();
    if (!editing || !trimmed || !/^\d{2}:\d{2}$/.test(time)) return;
    if (trimmed === meal.name && time === meal.time) return;
    const timer = setTimeout(() => {
      run({ name: trimmed, time }).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, name, time, meal.name, meal.time]);

  return (
    <Card tone="background" style={[styles.card, { borderWidth: 1, borderColor: theme.primary }]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <ThemedText type="smallBold">
            {meal.time} · {meal.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {total.kcal} kcal · P {total.protein} · H {total.carbs} · G {total.fat}
          </ThemedText>
        </View>
        {/* El lápiz abre la edición de nombre y hora; con la edición abierta se cierra con ✓. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Cerrar edición' : 'Editar comida'}
          onPress={() => setEditing((v) => !v)}
          hitSlop={10}
          style={styles.edit}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {editing ? (
              <Path d="M5 13l4 4L19 7" />
            ) : (
              <>
                <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
                <Path d="M13.5 6.5l4 4" />
              </>
            )}
          </Svg>
        </Pressable>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      {editing && (
        <View style={styles.block}>
          <View style={styles.editRow}>
            <View style={styles.editName}>
              <Field
                label="Nombre"
                accessibilityLabel="Nombre de la comida"
                value={name}
                onChangeText={setName}
                style={{ backgroundColor: theme.backgroundSelected }}
              />
            </View>
            <View style={styles.editTime}>
              <TimeField label="Hora" value={time} onChange={setTime} background={theme.backgroundSelected} />
            </View>
          </View>
          <LinkButton title="Borrar comida" onPress={onRemove} />
        </View>
      )}

      {meal.items.map((item, index) => {
        const food = byId.get(item.foodId);
        const macros = food ? foodMacros(food, item.grams) : null;
        return (
          <View key={`${item.foodId}-${index}`} style={styles.item}>
            <View style={styles.headerText}>
              <ThemedText>
                {item.grams} g · {food?.name ?? 'Alimento no disponible'}
              </ThemedText>
              {macros && (
                <ThemedText type="small" themeColor="textSecondary">
                  {macros.kcal} kcal · P {macros.protein} · H {macros.carbs} · G {macros.fat}
                </ThemedText>
              )}
            </View>
            <Pressable
              accessibilityLabel={`Quitar ${food?.name ?? 'alimento'}`}
              hitSlop={10}
              onPress={() => run({ items: meal.items.filter((_, i) => i !== index) }).catch(() => {})}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>✕</ThemedText>
            </Pressable>
          </View>
        );
      })}

      {meal.items.length === 0 && !adding && (
        <ThemedText type="small" themeColor="textSecondary">
          Sin alimentos todavía.
        </ThemedText>
      )}

      {adding ? (
        <FoodPicker
          foods={foods}
          onCancel={() => setAdding(false)}
          onPick={async (foodId, grams) => {
            await run({ items: [...meal.items, { foodId, grams }] });
            setAdding(false);
          }}
        />
      ) : (
        <LinkButton title="+ Añadir alimento" onPress={() => setAdding(true)} />
      )}
      <ErrorText message={error} />
    </Card>
  );
}

/** Busca un alimento del catálogo y pide la cantidad: en gramos o con una de sus porciones. */
export function FoodPicker({
  foods,
  onPick,
  onCancel,
}: {
  foods: Food[];
  onPick: (foodId: string, grams: number) => Promise<void>;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = foodNameKey(query);
  const results = useMemo(
    () =>
      key ? foods.filter((f) => foodNameKey(f.name).includes(key)).slice(0, MAX_RESULTS) : [],
    [foods, key],
  );

  const amount = toNumber(grams);
  const preview = chosen && amount > 0 ? foodMacros(chosen, amount) : null;

  async function add() {
    if (!chosen) return;
    if (!(amount > 0 && amount <= 5000)) return setError('Escribe los gramos (entre 1 y 5000)');
    setSaving(true);
    setError(null);
    try {
      await onPick(chosen.id, amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido añadir');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.picker, { backgroundColor: theme.backgroundSelected }]}>
      {chosen ? (
        <>
          <ThemedText type="smallBold">{chosen.name}</ThemedText>
          <Field
            label="Cantidad (g)"
            accessibilityLabel="Gramos"
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            placeholder="g"
            autoFocus
            style={{ backgroundColor: theme.backgroundElement }}
          />
          {chosen.portions.length > 0 && (
            <View style={styles.chips}>
              {chosen.portions.map((p) => (
                <Chip
                  key={p.name}
                  label={`${p.name} (${p.grams} g)`}
                  active={amount === p.grams}
                  onPress={() => setGrams(String(p.grams))}
                />
              ))}
            </View>
          )}
          {preview && (
            <ThemedText type="small" themeColor="textSecondary">
              {preview.kcal} kcal · P {preview.protein} · H {preview.carbs} · G {preview.fat}
            </ThemedText>
          )}
          <ErrorText message={error} />
          <Button title="Añadir a la comida" onPress={add} loading={saving} />
          <LinkButton title="Elegir otro alimento" onPress={() => setChosen(null)} centered />
        </>
      ) : (
        <>
          <Field
            label="Buscar alimento"
            accessibilityLabel="Buscar alimento"
            value={query}
            onChangeText={setQuery}
            placeholder="Pollo, arroz, plátano…"
            autoCapitalize="none"
            autoFocus
            style={{ backgroundColor: theme.backgroundElement }}
          />
          {key && results.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No hay nada con ese nombre. Puedes crearlo en el catálogo de alimentos.
            </ThemedText>
          )}
          {results.map((food) => (
            <Pressable
              key={food.id}
              accessibilityRole="button"
              onPress={() => {
                setChosen(food);
                setGrams(food.portions[0] ? String(food.portions[0].grams) : '100');
              }}
              style={styles.result}>
              <ThemedText>{food.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {food.kcal} kcal / 100 g
              </ThemedText>
            </Pressable>
          ))}
          <LinkButton title="Cancelar" onPress={onCancel} centered />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: { justifyContent: 'center', minHeight: 44 },
  titles: { alignItems: 'center', paddingHorizontal: 36 },
  edit: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: Spacing.one },
  divider: { height: 2, borderRadius: 1, marginBottom: Spacing.one },
  headerText: { flex: 1 },
  block: { gap: Spacing.three },
  editRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  editName: { flex: 1, gap: Spacing.one },
  editTime: { width: 130, gap: Spacing.one },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  picker: { gap: Spacing.two, padding: Spacing.three, borderRadius: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  result: { paddingVertical: Spacing.one },
});
