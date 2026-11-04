import {
  GOALS,
  calculateTargets,
  dietMacros,
  missingTargetData,
  type Goal,
} from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Button, Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { MealCard } from '@/components/meal-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { isValidISODate, todayISO } from '@/lib/dates';
import { useDiets } from '@/lib/diets';
import { useFoods } from '@/lib/foods';
import { useMe } from '@/lib/me';
import { GOAL_LABELS } from '@/lib/profile-labels';
import { useSettings } from '@/lib/settings';

/** Dieta: sus datos, el objetivo diario calculado y las comidas del día con sus alimentos. */
export function DietEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { diets, loading, create, update, remove, addMeal, updateMeal, removeMeal } = useDiets();
  const { settings, setActiveDiet } = useSettings();
  const { profile, latestWeight } = useMe();
  const { foods } = useFoods();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const isNew = id === 'nueva';
  const existing = isNew ? undefined : diets.find((d) => d.id === id);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal>(profile.goal ?? 'mantener');
  const [goalTouched, setGoalTouched] = useState(false);
  const [startDate, setStartDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingMeal, setAddingMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealTime, setMealTime] = useState('08:00');

  // El formulario se rellena una sola vez, cuando la dieta está disponible.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !existing) return;
    initialized.current = true;
    setName(existing.name);
    setGoal(existing.goal);
    setStartDate(existing.startDate);
  }, [existing]);

  // En una dieta nueva el objetivo parte del del perfil, que puede llegar después de abrir la pantalla.
  useEffect(() => {
    if (isNew && !goalTouched && profile.goal) setGoal(profile.goal);
  }, [isNew, goalTouched, profile.goal]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/dieta'));
  const back = <LinkButton title="Atrás" onPress={goBack} />;

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Ponle un nombre a la dieta');
    if (!isValidISODate(startDate)) return setError('Elige una fecha de inicio válida');

    setSaving(true);
    setError(null);
    try {
      const data = { name: trimmed, goal, startDate };
      if (isNew) {
        const created = await create(data);
        // Recién creada está vacía: se pasa a su página para añadirle comidas.
        router.replace({ pathname: '/mi-dieta/[id]', params: { id: created.id } });
      } else {
        await update(id, data);
        goBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      'Borrar dieta',
      `Se borrará «${existing.name}» con sus ${existing.meals.length} comidas.`,
      'Borrar',
    );
    if (!ok) return;
    try {
      await remove(existing.id);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  async function onActivate() {
    try {
      await setActiveDiet(existing!.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido activar');
    }
  }

  async function onAddMeal() {
    if (!existing) return;
    if (!mealName.trim()) return setError('Ponle un nombre a la comida');
    setError(null);
    try {
      await addMeal(existing.id, { name: mealName.trim(), time: mealTime, items: [] });
      setMealName('');
      setAddingMeal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido añadir la comida');
    }
  }

  if (!isNew && !existing) {
    return (
      <Screen title="Dieta" stacked action={back}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado esta dieta.</ThemedText>
        )}
      </Screen>
    );
  }

  const weightKg = latestWeight?.weightKg ?? null;
  const targetInput = { ...profile, weightKg };
  const targets = existing
    ? calculateTargets({ ...targetInput, goal: existing.goal, today: todayISO() })
    : null;
  const missing = missingTargetData(targetInput);
  const total = existing ? dietMacros(existing, byId) : null;
  const isActive = existing ? settings.activeDietId === existing.id : false;

  return (
    <Screen title={isNew ? 'Nueva dieta' : existing!.name} stacked action={back}>
      <Field
        label="Nombre"
        accessibilityLabel="Nombre de la dieta"
        value={name}
        onChangeText={setName}
        placeholder="Definición, Volumen…"
      />
      <View style={styles.goals}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Objetivo
        </ThemedText>
        <View style={styles.chips}>
          {GOALS.map((g) => (
            <Chip key={g} label={GOAL_LABELS[g]} active={goal === g} onPress={() => {
                setGoal(g);
                setGoalTouched(true);
              }}
            />
          ))}
        </View>
      </View>
      <DateField label="Fecha de inicio" value={startDate} onChange={setStartDate} />

      <ErrorText message={error} />
      <Button title={isNew ? 'Crear dieta' : 'Guardar cambios'} onPress={onSave} loading={saving} />

      {existing && total && (
        <>
          <Card tone="primarySoft" style={styles.targets}>
            <ThemedText type="smallBold">Tu día en esta dieta</ThemedText>
            <ThemedText>
              {total.kcal} kcal · P {total.protein} · H {total.carbs} · G {total.fat}
            </ThemedText>
            {targets ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Objetivo calculado: {targets.kcal} kcal · P {targets.protein} · H {targets.carbs} · G{' '}
                  {targets.fat}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {total.kcal === 0
                    ? 'Añade comidas para ir llenando el día.'
                    : total.kcal === targets.kcal
                      ? 'Justo en el objetivo.'
                      : total.kcal < targets.kcal
                        ? `Te faltan ${targets.kcal - total.kcal} kcal para el objetivo.`
                        : `Te pasas ${total.kcal - targets.kcal} kcal del objetivo.`}
                </ThemedText>
                {targets.raisedToSafeMinimum && (
                  <ThemedText type="small" themeColor="textSecondary">
                    El objetivo se ha subido al mínimo seguro: no se recomiendan menos calorías.
                  </ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  Con tu metabolismo basal ({targets.bmr} kcal), tu actividad y tu peso de{' '}
                  {weightKg} kg. Es una estimación orientativa y no sustituye a un profesional
                  sanitario.
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Para calcular tu objetivo diario faltan en «Yo»: {missing.join(', ')}.
              </ThemedText>
            )}
          </Card>

          <ThemedText type="smallBold" style={styles.section}>
            Comidas
          </ThemedText>
          {existing.meals.length === 0 && !addingMeal && (
            <ThemedText themeColor="textSecondary">
              Aún no tiene comidas. Añade las del día: desayuno, comida, cena…
            </ThemedText>
          )}
          {existing.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              foods={foods}
              byId={byId}
              onChange={async (changes) => {
                await updateMeal(existing.id, meal.id, changes);
              }}
              onRemove={async () => {
                const ok = await confirmAction('Borrar comida', `Se borrará «${meal.name}».`, 'Borrar');
                if (ok) await removeMeal(existing.id, meal.id).catch(() => {});
              }}
            />
          ))}

          {addingMeal ? (
            <Card style={styles.newMeal}>
              <Field
                label="Nombre de la comida"
                accessibilityLabel="Nombre de la nueva comida"
                value={mealName}
                onChangeText={setMealName}
                placeholder="Desayuno, Comida, Cena…"
                style={{ backgroundColor: theme.backgroundSelected }}
              />
              <TimeField label="Hora" value={mealTime} onChange={setMealTime} />
              <Button title="Añadir comida" onPress={onAddMeal} />
              <LinkButton title="Cancelar" onPress={() => setAddingMeal(false)} centered />
            </Card>
          ) : (
            <Button variant="secondary" title="+ Añadir comida" onPress={() => setAddingMeal(true)} />
          )}

          {isActive ? (
            <Card tone="primarySoft">
              <ThemedText type="smallBold">Es tu dieta actual</ThemedText>
            </Card>
          ) : (
            <Button title="Usar como mi dieta actual" onPress={onActivate} />
          )}
          <Button variant="danger" title="Borrar dieta" onPress={onDelete} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  goals: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  targets: { gap: Spacing.one },
  section: { marginTop: Spacing.two },
  newMeal: { gap: Spacing.two },
});
