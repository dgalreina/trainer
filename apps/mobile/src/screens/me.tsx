import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayTimeline } from '@/components/day-timeline';
import { Chip, ErrorText, LinkButton } from '@/components/form';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WeighInCard } from '@/components/weigh-in-card';
import { Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { addDays, formatLongDay, formatTime, mondayOf, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useWeekEvents, type DayEvent } from '@/lib/week-events';

type Section = 'calendario' | 'datos';

/** «Yo»: el calendario del día (qué hice y a qué hora) y los datos personales. */
export function MeScreen() {
  const { removeWeight } = useMe();
  const [section, setSection] = useState<Section>('calendario');
  const [day, setDay] = useState(todayISO);
  const [error, setError] = useState<string | null>(null);

  const { eventsOf, error: loadError, moveEvent } = useWeekEvents(mondayOf(day));
  const dayEvents = eventsOf(day);
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
    <Screen title="Yo">
      <View style={styles.sections}>
        <Chip label="Calendario" active={section === 'calendario'} onPress={() => setSection('calendario')} />
        <Chip label="Mis datos" active={section === 'datos'} onPress={() => setSection('datos')} />
      </View>

      {section === 'calendario' ? (
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
          <ErrorText message={error ?? loadError} />
          <DayTimeline day={day} events={dayEvents} onPressEvent={onPressEvent} onMoveEvent={moveEvent} />
          <WeighInCard day={day} />
        </>
      ) : (
        <ProfileForm />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', gap: Spacing.two },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flex: 1, alignItems: 'center' },
  dayText: { textAlign: 'center' },
  arrow: { paddingHorizontal: Spacing.three, lineHeight: 36 },
});
