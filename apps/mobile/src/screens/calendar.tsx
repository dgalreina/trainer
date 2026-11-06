import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DayTimeline } from '@/components/day-timeline';
import { ErrorText, LinkButton } from '@/components/form';
import { MealLogSection } from '@/components/meal-log-section';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WeighInCard } from '@/components/weigh-in-card';
import { Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { addDays, formatLongDay, formatTime, mondayOf, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';
import { useWeekEvents, type DayEvent } from '@/lib/week-events';

/** Calendario del día: qué hice y a qué hora (entrenos, comidas y pesadas). */
export function CalendarScreen() {
  const { removeWeight } = useMe();
  const [day, setDay] = useState(todayISO);
  const [error, setError] = useState<string | null>(null);

  const { eventsOf, plannedOf, mealsOf, error: loadError, moveEvent, reload } = useWeekEvents(mondayOf(day));
  const { settings, dietOn } = useSettings();
  const dayEvents = [...eventsOf(day), ...plannedOf(day)].sort((a, b) => a.start.getTime() - b.start.getTime());

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
      <DayTimeline day={day} events={dayEvents} onPressEvent={onPressEvent} onMoveEvent={moveEvent} />
      {/* Lo de abajo queda fijo; si crece (formulario abierto, muchas comidas) tiene su propio scroll. */}
      <ScrollView style={styles.bottom} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.bottomContent}>
          <MealLogSection day={day} logs={mealsOf(day)} onChanged={reload} />
          <WeighInCard day={day} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottom: { flexGrow: 0, flexShrink: 0, maxHeight: '45%' },
  bottomContent: { gap: Spacing.three },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flex: 1, alignItems: 'center' },
  dayText: { textAlign: 'center' },
  notice: { textAlign: 'center' },
  arrow: { paddingHorizontal: Spacing.three, lineHeight: 36 },
});
