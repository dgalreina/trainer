import { calculateTargets, dayEnergy, loggedMacros, routineTitle } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { DayTimeline } from '@/components/day-timeline';
import { Button, ErrorText, LinkButton } from '@/components/form';
import { MealEditor, type MealDraft, type MealForm } from '@/components/meal-editor';
import { MealLogSection } from '@/components/meal-log-section';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { WAVES_HEIGHT_COMPACT } from '@/components/waves';
import { WeighInSheet } from '@/components/weigh-in-card';
import { Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { addDays, currentDay, dayStart, formatLongDay, formatTime, mondayOf, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import { useTrainings } from '@/lib/trainings';
import { useWeekEvents, type DayEvent } from '@/lib/week-events';

/** Qué se está haciendo con una comida: la que se edita (o ninguna, si es nueva) y su formulario. */
interface MealEditing {
  target: DayEvent | null;
  form: MealForm;
}

/**
 * Vuelve a pintar la pantalla cada minuto y al volver a la app: así «hoy» cambia solo al pasar por la hora
 * a la que empieza el día (iOS suspende las PWA en segundo plano, y entonces no hay temporizador).
 */
function useMinuteTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const timer = setInterval(bump, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && bump();
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

/** Calendario del día: qué hice y a qué hora (entrenos, comidas y pesadas). */
export function CalendarScreen() {
  useMinuteTick();
  const router = useRouter();
  const { removeWeight, profile, latestWeight } = useMe();
  const { settings, dietOn, activeTraining, dayStartMinutes } = useSettings();
  // El día que se mira: el que se haya elegido o, si no, el de ahora (que depende de la hora a la que empieza el día).
  const [picked, setPicked] = useState<string | null>(null);
  const today = currentDay(dayStartMinutes);
  const day = picked ?? today;
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
        dayStart: dayStart(day, dayStartMinutes).getTime(),
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
    [day, dayEvents, bmr, weightKg, dayStartMinutes],
  );

  // Tocar un hueco del día abre «añadir»; de ahí sale la comida, la pesada o el entreno.
  const [slot, setSlot] = useState<Date | null>(null);
  const [choosingWorkout, setChoosingWorkout] = useState(false);
  const [meal, setMeal] = useState<MealEditing | null>(null);
  const [weighAt, setWeighAt] = useState<string | null>(null);
  // Alto del resumen que flota abajo: la línea de tiempo deja ese hueco al final para poder verlo todo.
  const [summaryHeight, setSummaryHeight] = useState(0);

  // Marcas discretas al principio del día: cuándo empieza una dieta (rige sin fin desde que se activa) o un
  // entrenamiento. Solo se guarda el día, no la hora, así que van al principio.
  const { trainings } = useTrainings();
  const marks = useMemo(() => {
    const list: string[] = [];
    if (settings.dietSchedule.some((e) => e.from === day && e.dietId)) {
      const diet = dietOn(day);
      if (diet) list.push(`Comienza la dieta «${diet.name}»`);
    }
    for (const training of trainings) {
      if (training.startDate === day) list.push(`Comienza el entrenamiento «${training.name}»`);
    }
    return list;
  }, [settings.dietSchedule, dietOn, trainings, day]);

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
      fullBleed
      wavesHeight={WAVES_HEIGHT_COMPACT}
      fixedTop={
        <>
          <View style={styles.dayNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Día anterior"
              onPress={() => setPicked(addDays(day, -1))}
              hitSlop={12}>
              <ThemedText type="subtitle" style={styles.arrow}>
                ‹
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.dayTitle}>
              <ThemedText type="smallBold" style={styles.dayText}>
                {formatLongDay(day)}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Día siguiente"
              onPress={() => setPicked(addDays(day, 1))}
              hitSlop={12}>
              <ThemedText type="subtitle" style={styles.arrow}>
                ›
              </ThemedText>
            </Pressable>
          </View>
          {/* Siempre ocupa su sitio (invisible en hoy): si apareciera y desapareciera, la cabecera cambiaría de alto y el día daría un salto. */}
          <View style={day === today ? styles.hidden : undefined} pointerEvents={day === today ? 'none' : 'auto'}>
            <LinkButton centered title="Ir a hoy" onPress={() => setPicked(null)} />
          </View>
          <ErrorText message={error ?? loadError} />
        </>
      }>
      {(topInset) => (
        <>
          <DayTimeline
            day={day}
            events={dayEvents}
            onPressEvent={onPressEvent}
            onEditEvent={onEditEvent}
            onMoveEvent={moveEvent}
            onPressSlot={setSlot}
            energy={energy}
            startMinutes={dayStartMinutes}
            topInset={topInset}
            marks={marks}
            bottomInset={summaryHeight}
          />
          {/* El resumen flota sobre la gráfica, que llega hasta el borde de abajo. Solo la tarjeta capta toques. */}
          <View pointerEvents="box-none" style={styles.floating} onLayout={(e) => setSummaryHeight(e.nativeEvent.layout.height)}>
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
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  hidden: { opacity: 0 },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flex: 1, alignItems: 'center' },
  dayText: { textAlign: 'center' },
  arrow: { paddingHorizontal: Spacing.three, lineHeight: 36 },
});
