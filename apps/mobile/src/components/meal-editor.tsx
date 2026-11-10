import { foodMacros, sumMacros, type Diet, type MealItem } from '@trainer/shared';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { FoodPicker } from '@/components/meal-card';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, timeInDay } from '@/lib/dates';
import { useFoods } from '@/lib/foods';
import { useSettings } from '@/lib/settings';

export interface MealForm {
  name: string;
  /** "HH:MM" */
  time: string;
  items: MealItem[];
}

/** Lo que se guarda: el nombre, el momento exacto y los alimentos. */
export interface MealDraft {
  name: string;
  date: Date;
  items: MealItem[];
}

/**
 * Ventana para crear o editar una comida de un día. Guardar o borrar solo afecta a esa comida de
 * ese día: si venía de la dieta, la plantilla de la dieta no se toca (lo decide quien la abre).
 */
export function MealEditor({
  visible,
  day,
  initial,
  diet,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  day: string;
  initial: MealForm;
  /** La dieta que rige ese día: al crear una comida nueva se puede empezar desde una suya. */
  diet?: Diet | null;
  canDelete: boolean;
  onSave: (draft: MealDraft) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { foods } = useFoods();
  const { dayStartMinutes } = useSettings();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const [name, setName] = useState(initial.name);
  const [time, setTime] = useState(initial.time);
  const [items, setItems] = useState<MealItem[]>(initial.items);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre, parte de lo que se le pasa (la ventana vive siempre montada).
  useEffect(() => {
    if (!visible) return;
    setName(initial.name);
    setTime(initial.time);
    setItems(initial.items);
    setPicking(false);
    setError(null);
    // Solo al abrirse: las ediciones en curso no se pisan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const total = sumMacros(
    items.flatMap((item) => {
      const food = byId.get(item.foodId);
      return food ? [foodMacros(food, item.grams)] : [];
    }),
  );

  async function save() {
    if (!name.trim()) return setError('Ponle un nombre a la comida');
    if (items.length === 0) return setError('Añade al menos un alimento');
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return setError('Elige una hora válida');

    // La hora se coloca dentro del día del usuario: antes de su hora de inicio, es de la madrugada siguiente.
    const date = timeInDay(day, time, dayStartMinutes);

    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), date, items });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la comida');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar la comida');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ThemedText type="smallBold">Comida del {formatDay(day)}</ThemedText>

      {!canDelete && diet && diet.meals.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Empezar desde tu dieta «{diet.name}»:
          </ThemedText>
          <View style={styles.chips}>
            {diet.meals.map((meal) => (
              <Chip
                key={meal.id}
                label={`${meal.time} ${meal.name}`}
                active={false}
                onPress={() => {
                  setName(meal.name);
                  setTime(meal.time);
                  setItems(meal.items);
                }}
              />
            ))}
          </View>
        </>
      )}

      <Field
        label="Nombre"
        accessibilityLabel="Nombre de la comida"
        value={name}
        onChangeText={setName}
        placeholder="Desayuno, Comida, Cena…"
        style={{ backgroundColor: theme.backgroundSelected }}
      />
      <TimeField label="Hora" value={time} onChange={setTime} background={theme.backgroundSelected} />

      {items.map((item, index) => {
        const food = byId.get(item.foodId);
        const macros = food ? foodMacros(food, item.grams) : null;
        return (
          <View key={`${item.foodId}-${index}`} style={styles.itemRow}>
            <View style={styles.itemText}>
              <ThemedText>
                {item.grams} g · {food?.name ?? 'Alimento'}
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
              onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>✕</ThemedText>
            </Pressable>
          </View>
        );
      })}

      {picking ? (
        <FoodPicker
          foods={foods}
          onCancel={() => setPicking(false)}
          onPick={async (foodId, grams) => {
            setItems((prev) => [...prev, { foodId, grams }]);
            setPicking(false);
          }}
        />
      ) : (
        <LinkButton title="+ Añadir alimento" onPress={() => setPicking(true)} />
      )}

      {items.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Total: {total.kcal} kcal · P {total.protein} · H {total.carbs} · G {total.fat}
        </ThemedText>
      )}
      <ErrorText message={error} />
      <Button title="Guardar comida" onPress={save} loading={saving} />
      {canDelete && <Button variant="danger" title="Borrar comida" onPress={remove} disabled={saving} />}
      <Button variant="secondary" title="Cancelar" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  itemText: { flex: 1 },
});
