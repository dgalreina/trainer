import { calculateTargets, dayEnergy, loggedMacros, routineTitle } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayTimeline } from '@/components/day-timeline';
import { Button, ErrorText, LinkButton } from '@/components/form';
import { MealEditor, type MealDraft, type MealForm } from '@/components/meal-editor';
import { MealLogSection } from '@/components/meal-log-section';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { WeighInSheet } from '@/components/weigh-in-card';
import { Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { addDays, formatLongDay, formatTime, mondayOf, startOfDay, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import { useWeekEvents, type DayEvent } from '@/lib/week-events';

/** Qué se está haciendo con una comida: la que se edita (o ninguna, si es nueva) y su formulario. */
interface MealEditing {
  target: DayEvent | null;
  form: MealForm;
}

/** Calendario del día: qué hice y a qué hora (entrenos, comidas y pesadas). */
export function CalendarScreen() {
  const router = useRouter();
  const { removeWeight, profile, latestWeight } = useMe();
  const [day, setDay] = useState(todayISO);
  const [error, setError] = useState<string | null>(null);

  const {
    eventsOf,
    plannedOf,
    mealsOf,
    saveMeal,
    removeMeal,
    error: loadError,
    moveEvent,
  } = useWeekEvents(mondayOf(day));
  const { settings, dietOn, activeTraining } = useSettings();
  const planned = useMemo(() => plannedOf(day), [plannedOf, day]);
  const dayEvents = useMemo(
    () => [...eventsOf(day), ...planned].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [eventsOf, planned, day],
  );

  // Gasto, consumo y balance del día para las gráficas: el basal sale del perfil (Mifflin-St Jeor, con el
  // último peso y la edad de hoy, también en días pasados) y los entrenos se estiman; lo comido es lo
  // registrado más lo de la dieta que se da por comido. Un entreno en curso no gasta hasta finalizarlo.
  const weightKg = latestWeight?.weightKg ?? null;
  const bmr =
    calculateTargets({
      ...profile,
      weightKg,
      goal: profile.goal ?? dietOn(day)?.goal ?? 'mantener',
      today: todayISO(),
    })?.bmr ?? null;
  const energy = useMemo(
    () =>
      dayEnergy({
        dayStart: startOfDay(day).getTime(),
        bmr,
        weightKg,
        workouts: dayEvents
          .filter((e) => e.kind === 'workout' && !e.inProgress)
          .map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
        meals: dayEvents.flatMap((e) =>
          e.kind === 'meal' && e.log
            ? [{ at: e.start.getTime(), kcal: loggedMacros([e.log]).kcal }]
            : e.kind === 'plan' && e.macros
              ? [{ at: e.start.getTime(), kcal: e.macros.kcal }]
              : [],
        ),
      }),
    [day, dayEvents, bmr, weightKg],
  );

  // Tocar un hueco del día abre «añadir»; de ahí sale la comida, la pesada o el entreno.
  const [slot, setSlot] = useState<Date | null>(null);
  const [choosingWorkout, setChoosingWorkout] = useState(false);
  const [meal, setMeal] = useState<MealEditing | null>(null);
  const [weighAt, setWeighAt] = useState<string | null>(null);

  // Avisos del día: la dieta rige sin fin desde que se activa.
  const dietChange = settings.dietSchedule.find((e) => e.from === day);
  const startingDiet = dietChange?.dietId ? dietOn(day) : null;
  const stoppedDiet = dietChange && !dietChange.dietId;
  const today = todayISO();

  async function onPressEvent(event: DayEvent) {
    // De momento solo las pesadas se pueden borrar desde aquí; los entrenos se verán en un historial.
    if (event.kind !== 'weight' || !event.weightId) return;
    const ok = await confirmAction(
      'Borrar pesada',
      `Se borrará la pesada de ${event.title} de las ${formatTime(event.start)}.`,
      'Borrar',
    );
    if (!ok) return;
    try {
      await removeWeight(event.weightId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  /** El lápiz de una comida: se abre su editor con lo que tiene (la de la dieta, con lo de la dieta). */
  function onEditEvent(event: DayEvent) {
    const items = event.plan
      ? event.plan.meal.items
      : (event.log?.items ?? []).map(({ foodId, grams }) => ({ foodId, grams }));
    setMeal({ target: event, form: { name: event.title, time: formatTime(event.start), items } });
  }

  async function onSaveMeal(draft: MealDraft) {
    await saveMeal(meal?.target ?? null, draft);
    setMeal(null);
  }

  async function onDeleteMeal() {
    const target = meal?.target;
    if (!target) return;
    const fromDiet = Boolean(target.plan ?? target.log?.dietMealId);
    const ok = await confirmAction(
      'Borrar comida',
      fromDiet
        ? `Se quitará «${target.title}» solo de este día. Tu dieta no cambia.`
        : `Se borrará «${target.title}» de las ${formatTime(target.start)}.`,
      'Borrar',
    );
    if (!ok) return;
    await removeMeal(target);
    setMeal(null);
  }

  function closeSlot() {
    setSlot(null);
    setChoosingWorkout(false);
  }

  function startWorkout(trainingId: string, routineId: string) {
    const at = slot?.getTime();
    closeSlot();
    router.push({
      pathname: '/entreno/[id]/[rid]',
      params: { id: trainingId, rid: routineId, ...(at ? { at: String(at) } : {}) },
    });
  }

  return (
    <Screen
      scroll={false}
      fixedTop={
        <>
          <View style={styles.dayNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Día anterior"
              onPress={() => setDay(addDays(day, -1))}
              hitSlop={12}>
              <ThemedText type="subtitle" style={styles.arrow}>
                ‹
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDay(today)} style={styles.dayTitle}>
              <ThemedText type="smallBold" style={styles.dayText}>
                {formatLongDay(day)}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Día siguiente"
              onPress={() => setDay(addDays(day, 1))}
              hitSlop={12}>
              <ThemedText type="subtitle" style={styles.arrow}>
                ›
              </ThemedText>
            </Pressable>
          </View>
          {day !== today && <LinkButton centered title="Ir a hoy" onPress={() => setDay(today)} />}
        </>
      }>
      <ErrorText message={error ?? loadError} />
      {startingDiet && (
        <ThemedText type="small" themeColor="primaryText" style={styles.notice}>
          {day === today ? 'Desde hoy' : 'Desde este día'} sigues la dieta «{startingDiet.name}».
        </ThemedText>
      )}
      {stoppedDiet && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
          {day === today ? 'Desde hoy' : 'Desde este día'} no sigues ninguna dieta.
        </ThemedText>
      )}
      <DayTimeline
        day={day}
        events={dayEvents}
        onPressEvent={onPressEvent}
        onEditEvent={onEditEvent}
        onMoveEvent={moveEvent}
        onPressSlot={setSlot}
        energy={energy}
      />
      <View style={styles.bottom}>
        <MealLogSection day={day} logs={mealsOf(day)} planned={planned} energy={energy} />
      </View>

      {/* Añadir algo a la hora tocada. */}
      <Sheet visible={slot !== null} onClose={closeSlot}>
        {slot && !choosingWorkout && (
          <>
            <ThemedText type="smallBold">Añadir a las {formatTime(slot)}</ThemedText>
            <Button
              variant="secondary"
              title="Comida"
              onPress={() => {
                setMeal({ target: null, form: { name: '', time: formatTime(slot), items: [] } });
                closeSlot();
              }}
            />
            <Button
              variant="secondary"
              title="Peso"
              onPress={() => {
                setWeighAt(formatTime(slot));
                closeSlot();
              }}
            />
            <Button variant="secondary" title="Entrenamiento" onPress={() => setChoosingWorkout(true)} />
            <LinkButton centered title="Cancelar" onPress={closeSlot} />
          </>
        )}
        {slot && choosingWorkout && (
          <>
            <ThemedText type="smallBold">¿Qué entrenas a las {formatTime(slot)}?</ThemedText>
            {activeTraining && activeTraining.routines.length > 0 ? (
              activeTraining.routines.map((routine) => (
                <Button
                  key={routine.id}
                  variant="secondary"
                  title={routineTitle(activeTraining.routines, routine.id)}
                  onPress={() => startWorkout(activeTraining.id, routine.id)}
                />
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No tienes un entrenamiento actual con rutinas. Elígelo en Entrenos.
              </ThemedText>
            )}
            <LinkButton centered title="Atrás" onPress={() => setChoosingWorkout(false)} />
          </>
        )}
      </Sheet>

      <MealEditor
        visible={meal !== null}
        day={day}
        initial={meal?.form ?? { name: '', time: '12:00', items: [] }}
        diet={dietOn(day)}
        canDelete={meal?.target != null}
        onSave={onSaveMeal}
        onDelete={onDeleteMeal}
        onClose={() => setMeal(null)}
      />

      <WeighInSheet visible={weighAt !== null} day={day} time={weighAt ?? '08:00'} onClose={() => setWeighAt(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottom: { flexGrow: 0, flexShrink: 0 },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flex: 1, alignItems: 'center' },
  dayText: { textAlign: 'center' },
  notice: { textAlign: 'center' },
  arrow: { paddingHorizontal: Spacing.three, lineHeight: 36 },
});
