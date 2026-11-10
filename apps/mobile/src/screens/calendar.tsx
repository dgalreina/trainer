import { calculateTargets, dayEnergy, loggedMacros, routineTitle } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { DayList, type DayListHandle, type DayModel } from '@/components/day-timeline';
import { Button, ErrorText, LinkButton } from '@/components/form';
import { MealEditor, type MealDraft, type MealForm } from '@/components/meal-editor';
import { MealLogSection } from '@/components/meal-log-section';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { WeighInSheet } from '@/components/weigh-in-card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { formatTime, isoOf, mondayOf, startOfDay, todayISO } from '@/lib/dates';
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
 * Vuelve a pintar la pantalla cada minuto y al volver a la app: así «hoy» cambia solo al pasar la medianoche
 * (iOS suspende las PWA en segundo plano, y entonces no hay temporizador).
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

/** Un valor que se actualiza 250 ms después del último cambio (la primera vez, al instante). */
function useSettled<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Calendario en scroll continuo: los días uno debajo de otro (qué hice y a qué hora: entrenos, comidas y
 * pesadas), cada uno con su tarjeta «Día X» al empezar. Abajo, la tarjeta de calorías del día que se muestra.
 */
export function CalendarScreen() {
  useMinuteTick();
  const router = useRouter();
  const theme = useTheme();
  const list = useRef<DayListHandle>(null);
  const { profile, latestWeight } = useMe();
  const { settings, dietOn, activeTraining } = useSettings();
  const { trainings } = useTrainings();
  const today = todayISO();
  // El día que se está mostrando (el del centro de la pantalla): la tarjeta de abajo habla de él y de él
  // cuelga qué semanas se cargan.
  const [visibleDay, setVisibleDay] = useState(today);

  const {
    eventsOf,
    plannedOf,
    mealsOf,
    saveMeal,
    removeMeal,
    isLoaded,
    error: loadError,
    moveEvent,
    // La ventana de semanas se mueve al terminar el scroll, no a cada lunes que se cruza: así volver a hoy
    // desde lejos no lanza cientos de peticiones.
  } = useWeekEvents(useSettled(mondayOf(visibleDay)));

  // El basal sale del perfil (Mifflin-St Jeor, con el último peso y la edad de hoy, también en días pasados) y
  // los entrenos se estiman; lo comido es lo registrado más lo de la dieta que se da por comido. Un entreno
  // en curso no gasta hasta finalizarlo.
  const weightKg = latestWeight?.weightKg ?? null;
  const bmr =
    calculateTargets({ ...profile, weightKg, goal: profile.goal ?? 'mantener', today })?.bmr ?? null;

  /** Todo lo de un día: sus tarjetas, sus gráficas y sus marcas. Se calcula día a día, solo para los que se pintan. */
  const modelOf = useCallback(
    (day: string): DayModel & { planned: DayEvent[]; logs: ReturnType<typeof mealsOf> } => {
      // Marcas discretas al principio del día: cuándo empieza una dieta (rige sin fin desde que se activa) o un
      // entrenamiento. Solo se guarda el día, no la hora, así que van al principio.
      const marks: string[] = [];
      if (settings.dietSchedule.some((e) => e.from === day && e.dietId)) {
        const diet = dietOn(day);
        if (diet) marks.push(`Comienza la dieta «${diet.name}»`);
      }
      for (const training of trainings) {
        if (training.startDate === day) marks.push(`Comienza el entrenamiento «${training.name}»`);
      }
      // Fuera de lo cargado no se sabe qué hay: ni se dice que esté vacío ni se suma la dieta (podría haber
      // comidas editadas o quitadas ese día).
      if (!isLoaded(day)) return { events: [], planned: [], logs: [], energy: null, marks, loaded: false };
      const planned = plannedOf(day);
      const events = [...eventsOf(day), ...planned].sort((a, b) => a.start.getTime() - b.start.getTime());
      const energy = dayEnergy({
        dayStart: startOfDay(day).getTime(),
        bmr,
        weightKg,
        workouts: events
          .filter((e) => e.kind === 'workout' && !e.inProgress)
          .map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
        meals: events.flatMap((e) =>
          e.kind === 'meal' && e.log
            ? [{ at: e.start.getTime(), kcal: loggedMacros([e.log]).kcal }]
            : e.kind === 'plan' && e.macros
              ? [{ at: e.start.getTime(), kcal: e.macros.kcal }]
              : [],
        ),
      });
      return { events, planned, logs: mealsOf(day), energy, marks, loaded: true };
    },
    [eventsOf, plannedOf, mealsOf, isLoaded, bmr, weightKg, settings.dietSchedule, dietOn, trainings],
  );
  const visible = useMemo(() => modelOf(visibleDay), [modelOf, visibleDay]);

  // Tocar un hueco de un día abre «añadir»; de ahí sale la comida, la pesada o el entreno. Todo lo que se
  // hace desde ahí es de ese día (no tiene por qué ser el que se muestra en la tarjeta de abajo).
  const [actionDay, setActionDay] = useState(today);
  const [slot, setSlot] = useState<Date | null>(null);
  const [choosingWorkout, setChoosingWorkout] = useState(false);
  const [meal, setMeal] = useState<MealEditing | null>(null);
  const [weighAt, setWeighAt] = useState<string | null>(null);
  /** La pesada que se edita (si se abrió desde un círculo); sin ella, la ventana crea una nueva. */
  const [weighEdit, setWeighEdit] = useState<{ id: string; kg: string } | null>(null);
  // Alto de la tarjeta de abajo: el «centro» de lo visible (el día que se muestra) queda por encima de ella.
  const [summaryHeight, setSummaryHeight] = useState(0);

  const onPressSlot = useCallback((time: Date) => {
    setActionDay(isoOf(time));
    setSlot(time);
  }, []);

  /** Tocar un círculo: la comida abre su editor, la pesada su ventana y el entreno en curso su pantalla. */
  const onPressEvent = useCallback(
    (event: DayEvent) => {
      if (event.kind === 'weight' && event.weightId) {
        setActionDay(isoOf(event.start));
        setWeighEdit({ id: event.weightId, kg: String(event.weightKg ?? '') });
        setWeighAt(formatTime(event.start));
        return;
      }
      if (event.kind === 'workout') {
        // Los entrenos terminados no hacen nada por ahora (irán a un historial).
        if (event.inProgress && event.draftOf) {
          router.push({
            pathname: '/entreno/[id]/[rid]',
            params: { id: event.draftOf.trainingId, rid: event.draftOf.routineId },
          });
        }
        return;
      }
      // Comida: se abre su editor con lo que tiene (la de la dieta, con lo de la dieta).
      const items = event.plan
        ? event.plan.meal.items
        : (event.log?.items ?? []).map(({ foodId, grams }) => ({ foodId, grams }));
      setActionDay(isoOf(event.start));
      setMeal({ target: event, form: { name: event.title, time: formatTime(event.start), items } });
    },
    [router],
  );

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
    <Screen fullBleed noWaves>
      {(topInset) => (
        <>
          <DayList
            ref={list}
            today={today}
            modelOf={modelOf}
            topInset={topInset}
            bottomInset={summaryHeight}
            onVisibleDay={setVisibleDay}
            onPressEvent={onPressEvent}
            onMoveEvent={moveEvent}
            onPressSlot={onPressSlot}
          />

          {/* Un fallo al cargar o borrar, justo bajo la barra de pestañas. */}
          {loadError ? (
            <View pointerEvents="none" style={[styles.error, { top: topInset }]}>
              <ErrorText message={loadError} />
            </View>
          ) : null}

          {/* Solo cuando hoy no está a la vista: un botón discreto para volver, con la flecha hacia donde está. */}
          {visibleDay !== today ? (
            <View pointerEvents="box-none" style={[styles.todayWrap, { bottom: summaryHeight + Spacing.two }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ir a hoy"
                onPress={() => list.current?.scrollToDay(today)}
                style={[styles.today, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="primaryText">
                  {visibleDay > today ? 'Hoy ↑' : 'Hoy ↓'}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {/* El resumen flota sobre los días y habla del que se muestra. Solo la tarjeta capta toques. */}
          <View pointerEvents="box-none" style={styles.floating} onLayout={(e) => setSummaryHeight(e.nativeEvent.layout.height)}>
            <MealLogSection
              day={visibleDay}
              logs={visible.logs}
              planned={visible.planned}
              energy={visible.energy}
              ready={visible.loaded}
            />
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
                    setWeighEdit(null);
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
            day={actionDay}
            initial={meal?.form ?? { name: '', time: '12:00', items: [] }}
            diet={dietOn(actionDay)}
            canDelete={meal?.target != null}
            onSave={onSaveMeal}
            onDelete={onDeleteMeal}
            onClose={() => setMeal(null)}
          />

          <WeighInSheet
            visible={weighAt !== null}
            day={actionDay}
            time={weighAt ?? '08:00'}
            weightId={weighEdit?.id}
            kg={weighEdit?.kg}
            onClose={() => setWeighAt(null)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  error: { position: 'absolute', left: 0, right: 0, paddingHorizontal: Spacing.four },
  todayWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end', paddingHorizontal: Spacing.four },
  today: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    ...({ boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)' } as object),
  },
});
