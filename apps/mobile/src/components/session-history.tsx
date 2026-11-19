import { routineTitle, sessionSetCount, sessionVolume, type WorkoutSession } from '@trainer/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { SelectField } from '@/components/select-field';
import { SessionSheet } from '@/components/session-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { isoOf } from '@/lib/dates';
import { formatShortDay, formatMonthYear } from '@/lib/dates';
import { useSessionsVersion } from '@/lib/session-events';
import { useTrainings } from '@/lib/trainings';

const PAGE = 100;
const ALL = 'all';

/** "1.250 kg" (sin decimales). */
const kg = (n: number) => `${n.toLocaleString('es-ES')} kg`;

/**
 * Historial de entrenos terminados, del más reciente al más antiguo y agrupados por mes. Se puede filtrar por
 * rutina; tocar uno abre su ficha (la misma del calendario), donde se corrige o se borra.
 */
export function SessionHistory() {
  const theme = useTheme();
  const { trainings } = useTrainings();
  const version = useSessionsVersion();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null);
  // Cada carga lleva un número: la respuesta de una vieja no pisa a la nueva.
  const request = useRef(0);

  const load = useCallback(async (before?: string) => {
    const mine = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const query = `limit=${PAGE}${before ? `&to=${encodeURIComponent(before)}` : ''}`;
      const page = await api.get<WorkoutSession[]>(`/sessions?${query}`);
      if (mine !== request.current) return;
      setSessions((prev) => (before ? [...prev, ...page] : page));
      setMore(page.length === PAGE);
    } catch (err) {
      if (mine !== request.current) return;
      setError(err instanceof Error ? err.message : 'No se ha podido cargar el historial');
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, []);

  // Al entrar y cada vez que se guarda, edita o borra un entreno.
  useEffect(() => {
    load();
  }, [load, version]);

  const titleOf = useCallback(
    (session: WorkoutSession) => {
      const training = trainings.find((t) => t.id === session.trainingId);
      const routine = training?.routines.find((r) => r.id === session.routineId);
      return training && routine ? routineTitle(training.routines, routine.id) : 'Entreno';
    },
    [trainings],
  );

  // Las rutinas que aparecen en el historial, con el entrenamiento al que pertenecen (varios tienen «Día 1»).
  const options = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions) {
      if (!session.routineId) continue;
      const key = `${session.trainingId}/${session.routineId}`;
      if (seen.has(key)) continue;
      const training = trainings.find((t) => t.id === session.trainingId);
      seen.set(key, training ? `${training.name} · ${titleOf(session)}` : titleOf(session));
    }
    return [
      { value: ALL, title: 'Todas las rutinas' },
      ...[...seen].map(([value, title]) => ({ value, title })),
    ];
  }, [sessions, trainings, titleOf]);

  const shown = useMemo(
    () => (filter === ALL ? sessions : sessions.filter((s) => `${s.trainingId}/${s.routineId}` === filter)),
    [sessions, filter],
  );

  // Por mes, conservando el orden (ya viene del más reciente al más antiguo).
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: WorkoutSession[] }[] = [];
    for (const session of shown) {
      const day = isoOf(new Date(session.date));
      const key = day.slice(0, 7);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        const label = formatMonthYear(day);
        group = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
        groups.push(group);
      }
      group.items.push(session);
    }
    return groups;
  }, [shown]);

  return (
    <>
      {options.length > 2 && (
        <SelectField options={options} selected={filter} onSelect={setFilter} accessibilityLabel="Filtrar por rutina" />
      )}
      <ErrorText message={error} />

      {!loading && !error && sessions.length === 0 && (
        <ThemedText themeColor="textSecondary">Todavía no has terminado ningún entreno. Cuando finalices uno, aparecerá aquí.</ThemedText>
      )}
      {!loading && sessions.length > 0 && shown.length === 0 && (
        <ThemedText themeColor="textSecondary">Esa rutina no tiene entrenos en lo cargado. Prueba con «Cargar más».</ThemedText>
      )}

      {months.map((month) => (
        <View key={month.key} style={styles.month}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {month.label}
          </ThemedText>
          {month.items.map((session) => {
            const volume = sessionVolume(session);
            const minutes = session.durationSeconds ? Math.round(session.durationSeconds / 60) : 0;
            const title = titleOf(session);
            return (
              <Card key={session.id} onPress={() => setOpen({ id: session.id, title })} style={styles.card}>
                <View style={styles.header}>
                  <ThemedText type="smallBold" style={styles.name}>
                    {title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatShortDay(isoOf(new Date(session.date)))}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {session.entries.length} {session.entries.length === 1 ? 'ejercicio' : 'ejercicios'} · {sessionSetCount(session)} series
                  {minutes > 0 ? ` · ${minutes} min` : ''}
                  {volume > 0 ? ` · ${kg(volume)}` : ''}
                </ThemedText>
              </Card>
            );
          })}
        </View>
      ))}

      {loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando el historial" />}
      {!loading && more && sessions.length > 0 && (
        <Button
          variant="secondary"
          title="Cargar más"
          onPress={() => load(sessions[sessions.length - 1].date)}
        />
      )}

      <SessionSheet sessionId={open?.id ?? null} title={open?.title ?? ''} onClose={() => setOpen(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  month: { gap: Spacing.two },
  card: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  name: { flex: 1 },
});
