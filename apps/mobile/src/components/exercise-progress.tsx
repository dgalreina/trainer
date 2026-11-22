import {
  exerciseProgress,
  exercisesDone,
  summarizeProgress,
  type ExercisePoint,
  type ProgressSummary,
  type WorkoutSession,
} from '@trainer/shared';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Card } from '@/components/card';
import { Chip, ErrorText, Field, LinkButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAllSessions } from '@/lib/all-sessions';
import { formatDay, isoOf } from '@/lib/dates';
import { useExercises } from '@/lib/exercises';
import { searchExercises } from '@/lib/exercise-search';

const CHART_HEIGHT = 200;
const PAD = { left: 40, right: 12, top: 14, bottom: 26 };
const DAY_MS = 86_400_000;

type Range = '1m' | '3m' | 'all';
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: '1m', label: '1 mes', days: 30 },
  { key: '3m', label: '3 meses', days: 90 },
  { key: 'all', label: 'Todo', days: null },
];

const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const dayOf = (iso: string) => formatDay(isoOf(new Date(iso)));

/** «Progreso»: cómo mejoras en cada ejercicio, solo con lo que has hecho de verdad (series guardadas en tus entrenos). */
export function ExerciseProgressSection() {
  const theme = useTheme();
  const { byId } = useExercises();
  const { sessions, loading, error } = useAllSessions();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const done = useMemo(() => exercisesDone(sessions), [sessions]);
  const doneExercises = useMemo(
    () => done.flatMap((d) => (byId.get(d.exerciseId) ? [{ ...d, exercise: byId.get(d.exerciseId)! }] : [])),
    [done, byId],
  );
  const shown = useMemo(() => {
    if (!query.trim()) return doneExercises;
    const ids = new Set(searchExercises(doneExercises.map((d) => d.exercise), query).map((e) => e.id));
    return doneExercises.filter((d) => ids.has(d.exerciseId));
  }, [doneExercises, query]);

  if (selected) {
    return <Detail exerciseId={selected} name={byId.get(selected)?.name ?? 'Ejercicio'} sessions={sessions} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Elige un ejercicio para ver cómo has ido mejorando. Solo salen los que has hecho en entrenos guardados.
      </ThemedText>
      {doneExercises.length > 6 && (
        <Field placeholder="Buscar ejercicio…" value={query} onChangeText={setQuery} accessibilityLabel="Buscar ejercicio" />
      )}
      <ErrorText message={error} />
      {loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando tus entrenos" />}
      {!loading && !error && doneExercises.length === 0 && (
        <ThemedText themeColor="textSecondary">Aún no hay datos: termina un entreno y sus ejercicios aparecerán aquí.</ThemedText>
      )}
      {!loading && doneExercises.length > 0 && shown.length === 0 && (
        <ThemedText themeColor="textSecondary">Ningún ejercicio hecho coincide con «{query}».</ThemedText>
      )}
      {shown.map(({ exerciseId, exercise, count, lastDate }) => (
        <Card key={exerciseId} onPress={() => setSelected(exerciseId)} style={styles.card}>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {count} {count === 1 ? 'vez' : 'veces'} · última: {dayOf(lastDate)}
          </ThemedText>
        </Card>
      ))}
    </>
  );
}

function Detail({
  exerciseId,
  name,
  sessions,
  onBack,
}: {
  exerciseId: string;
  name: string;
  sessions: WorkoutSession[];
  onBack: () => void;
}) {
  const [range, setRange] = useState<Range>('3m');
  const [width, setWidth] = useState(0);
  const all = useMemo(() => exerciseProgress(sessions, exerciseId), [sessions, exerciseId]);
  const summary = useMemo(() => summarizeProgress(all), [all]);

  // Los rangos cuentan desde el último entreno, no desde hoy: si llevas un mes sin entrenar, el gráfico no queda vacío.
  const points = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    if (days === null || all.length === 0) return all;
    const from = new Date(all[all.length - 1].date).getTime() - days * DAY_MS;
    return all.filter((p) => new Date(p.date).getTime() >= from);
  }, [all, range]);

  return (
    <>
      <LinkButton title="‹ Todos los ejercicios" onPress={onBack} />
      <ThemedText type="subtitle">{name}</ThemedText>
      {!summary ? (
        <ThemedText themeColor="textSecondary">Este ejercicio aún no tiene series con datos.</ThemedText>
      ) : (
        <>
          <View style={styles.chips}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={r.label} active={range === r.key} onPress={() => setRange(r.key)} compact />
            ))}
          </View>
          <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && points.length > 0 ? <ProgressChart points={points} metric={summary.metric} width={width} /> : null}
          </View>
          <Legend metric={summary.metric} />
          <Cards summary={summary} count={all.length} />
        </>
      )}
    </>
  );
}

function Legend({ metric }: { metric: 'kg' | 'reps' }) {
  const theme = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
        <ThemedText type="small" themeColor="textSecondary">
          {metric === 'kg' ? 'Mejor peso' : 'Mejor serie (repeticiones)'}
        </ThemedText>
      </View>
      {metric === 'kg' && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.teal }]} />
          <ThemedText type="small" themeColor="textSecondary">
            1RM estimada
          </ThemedText>
        </View>
      )}
    </View>
  );
}

/** El tiempo en horizontal (proporcional: dos entrenos seguidos quedan juntos y un parón se nota) y una línea por métrica. */
function ProgressChart({ points, metric, width }: { points: ExercisePoint[]; metric: 'kg' | 'reps'; width: number }) {
  const theme = useTheme();
  const plotW = width - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const main = (p: ExercisePoint) => (metric === 'kg' ? p.bestKg : p.bestReps);
  const showRm = metric === 'kg' && points.some((p) => p.oneRepMax > 0);
  const values = points.flatMap((p) => (showRm ? [main(p), p.oneRepMax] : [main(p)]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(metric === 'kg' ? 2 : 1, (hi - lo) * 0.15);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const x = (p: ExercisePoint) =>
    PAD.left + (t1 === t0 ? plotW / 2 : ((new Date(p.date).getTime() - t0) / (t1 - t0)) * plotW);
  const y = (value: number) => PAD.top + (1 - (value - min) / (max - min)) * plotH;
  const line = (value: (p: ExercisePoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p)},${y(value(p))}`).join(' ');
  const ticks = [min, (min + max) / 2, max];

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {ticks.map((tick) => (
        <G key={tick}>
          <Line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={theme.backgroundSelected} strokeWidth={1} />
          <SvgText x={PAD.left - 6} y={y(tick) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
            {num(tick)}
          </SvgText>
        </G>
      ))}
      {showRm && (
        <Path d={line((p) => p.oneRepMax)} stroke={theme.teal} strokeWidth={2} strokeDasharray="6 5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <Path d={line(main)} stroke={theme.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <Circle key={p.date} cx={x(p)} cy={y(main(p))} r={4} fill={theme.primary} />
      ))}
      <SvgText x={PAD.left} y={CHART_HEIGHT - 6} fontSize={11} fill={theme.textSecondary}>
        {dayOf(points[0].date)}
      </SvgText>
      {points.length > 1 && (
        <SvgText x={width - PAD.right} y={CHART_HEIGHT - 6} fontSize={11} fill={theme.textSecondary} textAnchor="end">
          {dayOf(points[points.length - 1].date)}
        </SvgText>
      )}
    </Svg>
  );
}

function Cards({ summary, count }: { summary: ProgressSummary; count: number }) {
  const { metric, best, first, last, monthChangePct } = summary;
  const value = (p: ExercisePoint) => (metric === 'kg' ? `${num(p.bestKg)} kg` : `${p.bestReps} reps`);
  const detail = (p: ExercisePoint) => (metric === 'kg' && p.bestReps > 0 ? `${num(p.bestKg)} kg × ${p.bestReps}` : value(p));
  return (
    <View style={styles.cards}>
      <Card tone="primarySoft" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Mejor marca
        </ThemedText>
        <ThemedText type="subtitle">{detail(best)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dayOf(best.date)}
        </ThemedText>
      </Card>
      <Card style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Primera vez → última ({count} {count === 1 ? 'entreno' : 'entrenos'})
        </ThemedText>
        <ThemedText type="smallBold">
          {value(first)} → {value(last)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dayOf(first.date)} → {dayOf(last.date)}
        </ThemedText>
      </Card>
      <Card style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Último mes
        </ThemedText>
        <ThemedText type="smallBold">
          {monthChangePct === null
            ? 'Aún no hay un entreno de hace un mes con el que comparar'
            : `${monthChangePct > 0 ? '+' : monthChangePct < 0 ? '−' : ''}${num(Math.abs(monthChangePct))} %`}
        </ThemedText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  cards: { gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two },
  legend: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
