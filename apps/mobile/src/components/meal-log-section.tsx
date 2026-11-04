import {
  calculateTargets,
  foodMacros,
  loggedMacros,
  sumMacros,
  type Food,
  type MealItem,
  type MealLog,
} from '@trainer/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { FoodPicker } from '@/components/meal-card';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { formatDay, formatTime, startOfDay, todayISO } from '@/lib/dates';
import { useFoods } from '@/lib/foods';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';

/** Hora con la que se propone la comida: ahora si es hoy; a mediodía en otro día. */
function defaultTime(day: string): string {
  return day === todayISO() ? formatTime(new Date()) : '12:00';
}

/** Lo comido en el día: el resumen frente al objetivo, cada comida, y el formulario para añadir otra. */
export function MealLogSection({
  day,
  logs,
  onChanged,
}: {
  day: string;
  logs: MealLog[];
  /** Se llama tras añadir o borrar una comida, para que el calendario se recargue. */
  onChanged: () => void;
}) {
  const theme = useTheme();
  const { foods } = useFoods();
  const { activeDiet } = useSettings();
  const { profile, latestWeight } = useMe();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState(() => defaultTime(day));
  const [items, setItems] = useState<MealItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eaten = loggedMacros(logs);
  const targets = calculateTargets({
    ...profile,
    weightKg: latestWeight?.weightKg ?? null,
    goal: activeDiet?.goal ?? profile.goal ?? 'mantener',
    today: todayISO(),
  });

  const draft = sumMacros(
    items.flatMap((item) => {
      const food = byId.get(item.foodId);
      return food ? [foodMacros(food, item.grams)] : [];
    }),
  );

  function openForm(preset?: { name: string; time: string; items: MealItem[] }) {
    setName(preset?.name ?? '');
    // La hora se propone al abrir, no al montar: si no, "ahora" sería la de cuando se abrió la app.
    setTime(preset?.time ?? defaultTime(day));
    setItems(preset?.items ?? []);
    setPicking(false);
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return setError('Ponle un nombre a la comida');
    if (items.length === 0) return setError('Añade al menos un alimento');
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return setError('Elige una hora válida');

    const moment = startOfDay(day);
    moment.setHours(Number(match[1]), Number(match[2]));

    setSaving(true);
    setError(null);
    try {
      await api.post('/me/meals', { date: moment.toISOString(), name: name.trim(), items });
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la comida');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(log: MealLog) {
    const ok = await confirmAction(
      'Borrar comida',
      `Se borrará «${log.name}» de las ${formatTime(new Date(log.date))}.`,
      'Borrar',
    );
    if (!ok) return;
    try {
      await api.delete(`/me/meals/${log.id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  return (
    <View style={styles.wrapper}>
      <Card tone="primarySoft" style={styles.summary}>
        <ThemedText type="smallBold">Comido este día</ThemedText>
        <ThemedText>
          {eaten.kcal} kcal · P {eaten.protein} · H {eaten.carbs} · G {eaten.fat}
        </ThemedText>
        {targets ? (
          <ThemedText type="small" themeColor="textSecondary">
            Objetivo: {targets.kcal} kcal ·{' '}
            {eaten.kcal <= targets.kcal
              ? `te quedan ${targets.kcal - eaten.kcal}`
              : `te pasas ${eaten.kcal - targets.kcal}`}
          </ThemedText>
        ) : null}
      </Card>

      {logs.map((log) => (
        <Card key={log.id} style={styles.log}>
          <View style={styles.logHeader}>
            <View style={styles.logText}>
              <ThemedText type="smallBold">
                {formatTime(new Date(log.date))} · {log.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {loggedMacros([log]).kcal} kcal
              </ThemedText>
            </View>
            <Pressable accessibilityLabel={`Borrar ${log.name}`} hitSlop={10} onPress={() => onDelete(log)}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>✕</ThemedText>
            </Pressable>
          </View>
          {log.items.map((item, index) => (
            <ThemedText key={`${item.foodId}-${index}`} type="small">
              {item.grams} g · {byId.get(item.foodId)?.name ?? 'Alimento'} ({item.kcal} kcal)
            </ThemedText>
          ))}
        </Card>
      ))}

      {open ? (
        <Card style={styles.form}>
          <ThemedText type="smallBold">Comida del {formatDay(day)}</ThemedText>

          {activeDiet && activeDiet.meals.length > 0 && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Empezar desde tu dieta «{activeDiet.name}»:
              </ThemedText>
              <View style={styles.chips}>
                {activeDiet.meals.map((meal) => (
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
          <TimeField label="Hora" value={time} onChange={setTime} />

          {items.map((item, index) => {
            const food: Food | undefined = byId.get(item.foodId);
            const macros = food ? foodMacros(food, item.grams) : null;
            return (
              <View key={`${item.foodId}-${index}`} style={styles.itemRow}>
                <View style={styles.logText}>
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
              Total: {draft.kcal} kcal · P {draft.protein} · H {draft.carbs} · G {draft.fat}
            </ThemedText>
          )}
          <ErrorText message={error} />
          <Button title="Guardar comida" onPress={save} loading={saving} />
          <Button variant="secondary" title="Cancelar" onPress={() => setOpen(false)} />
        </Card>
      ) : (
        <>
          <ErrorText message={error} />
          <Button variant="secondary" title="+ Registrar comida" onPress={() => openForm()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.three },
  summary: { gap: Spacing.one },
  log: { gap: Spacing.one },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logText: { flex: 1 },
  form: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
