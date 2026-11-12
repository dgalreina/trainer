import {
  dayEnergy,
  KCAL_PER_KG,
  weightTrend,
  type Calibration,
  type TrendDay,
  type TrendWeek,
  type WeightPoint,
} from '@trainer/shared';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDay, isoOf, mondayOf, todayISO } from '@/lib/dates';
import { useEnergyInput } from '@/lib/energy-input';
import { useWeekEvents } from '@/lib/week-events';

/** Cuántas semanas se miran (la actual incluida). */
const WEEKS = 12;
const CHART_HEIGHT = 190;
const PAD = { left: 40, right: 12, top: 14, bottom: 26 };

const kg = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedKg = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
const signedKcal = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Math.round(value)).toLocaleString('es-ES')}`;

/**
 * «Mi peso»: cómo ha cambiado tu peso frente a lo que dicen las calorías, por semanas (un día suelto no se puede comparar:
 * el peso varía 1-2 kg por agua, sal, comida…). Sale de las pesadas, las comidas y los entrenos que ya hay; no se guarda nada.
 */
export function WeightTrendSection() {
  const theme = useTheme();
  const today = todayISO();
  const weekStart = mondayOf(today);
  const { events, eventsOf, plannedOf, isLoaded, loading, error } = useWeekEvents(weekStart, { before: WEEKS - 1, after: 1 });
  const { energyInput, bmr } = useEnergyInput();
  const [width, setWidth] = useState(0);

  const trend = useMemo(() => {
    if (bmr === null) return null;
    const firstDay = addDays(weekStart, -7 * (WEEKS - 1));
    const days: TrendDay[] = [];
    // Hasta ayer: hoy aún no ha acabado.
    for (let day = firstDay; day < today; day = addDays(day, 1)) {
      if (!isLoaded(day)) continue;
      const list = [...eventsOf(day), ...plannedOf(day)];
      const energy = dayEnergy(energyInput(day, list));
      days.push({
        day,
        balance: energy.totals.balance,
        intake: energy.totals.intake,
        burn: energy.totals.burn,
        // Un día sin ninguna comida no es un día de ayuno: no se cuenta.
        counted: energy.totals.intake > 0,
      });
    }
    const weights = events
      .filter((e) => e.kind === 'weight' && e.weightKg !== undefined && isoOf(e.start) >= firstDay)
      .map((e) => ({ day: isoOf(e.start), weightKg: e.weightKg as number }));
    return weightTrend({ weights, days });
  }, [bmr, weekStart, today, isLoaded, eventsOf, plannedOf, energyInput, events]);

  if (bmr === null) {
    return (
      <Card tone="primarySoft">
        <ThemedText type="smallBold">Faltan datos</ThemedText>
        <ThemedText themeColor="textSecondary">
          Completa «Mis datos» (sexo, edad, altura y actividad) y registra tu peso para comparar el peso con las calorías.
        </ThemedText>
      </Card>
    );
  }
  if (loading && !trend) return <ActivityIndicator color={theme.primary} />;

  const weighed = trend?.points ?? [];
  return (
    <View style={styles.root}>
      <ThemedText themeColor="textSecondary">
        Compara cómo ha cambiado tu peso con lo que dicen tus calorías (unas {KCAL_PER_KG.toLocaleString('es-ES')} kcal de superávit ≈ 1 kg).
        Un día suelto no se puede comparar: el peso varía 1 o 2 kg por agua, sal o comida; por eso se mira por semanas, con el peso medio de
        cada una.
      </ThemedText>
      {error ? <ThemedText style={{ color: theme.danger }}>{error}</ThemedText> : null}

      {weighed.length < 2 ? (
        <Card tone="primarySoft">
          <ThemedText type="smallBold">Aún no hay suficiente</ThemedText>
          <ThemedText themeColor="textSecondary">
            Hacen falta pesadas en al menos dos semanas distintas (mejor por la mañana y en condiciones parecidas) y comidas registradas esos días.
          </ThemedText>
        </Card>
      ) : (
        <>
          <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 ? <TrendChart points={weighed} width={width} /> : null}
          </View>
          <View style={styles.legend}>
            <LegendDot color={theme.primary} label="Tu peso (media semanal)" />
            <LegendDot color={theme.amber} label="Lo que predicen tus kcal" />
          </View>
          {trend?.calibration ? <CalibrationCard calibration={trend.calibration} /> : null}
          <WeeksList weeks={trend?.weeks ?? []} />
        </>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Dos líneas por semana: el peso medio y, a trazos, el que daría partir de la primera y sumar lo que dicen las kcal. */
function TrendChart({ points, width }: { points: WeightPoint[]; width: number }) {
  const theme = useTheme();
  const plotW = width - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const values = points.flatMap((p) => (p.predictedKg === null ? [p.avgKg] : [p.avgKg, p.predictedKg]));
  const span = Math.max(...values) - Math.min(...values);
  const pad = Math.max(0.4, span * 0.15);
  const min = Math.min(...values) - pad;
  const max = Math.max(...values) + pad;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (value: number) => PAD.top + (1 - (value - min) / (max - min)) * plotH;

  const real = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.avgKg)}`).join(' ');
  // La línea prevista se corta donde faltan datos (sin comidas registradas no se puede predecir).
  let predicted = '';
  let drawing = false;
  points.forEach((p, i) => {
    if (p.predictedKg === null) {
      drawing = false;
      return;
    }
    predicted += `${drawing ? 'L' : 'M'}${x(i)},${y(p.predictedKg)} `;
    drawing = true;
  });
  const ticks = [min + pad, (min + max) / 2, max - pad];

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {ticks.map((tick) => (
        <G key={tick}>
          <Line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={theme.backgroundSelected} strokeWidth={1} />
          <SvgText x={PAD.left - 6} y={y(tick) + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
            {kg(tick)}
          </SvgText>
        </G>
      ))}
      <Path d={predicted} stroke={theme.amber} strokeWidth={2.5} strokeDasharray="6 5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={real} stroke={theme.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle key={p.monday} cx={x(i)} cy={y(p.avgKg)} r={4} fill={theme.primary} />
      ))}
      <SvgText x={PAD.left} y={CHART_HEIGHT - 6} fontSize={11} fill={theme.textSecondary}>
        {formatDay(points[0].monday)}
      </SvgText>
      <SvgText x={width - PAD.right} y={CHART_HEIGHT - 6} fontSize={11} fill={theme.textSecondary} textAnchor="end">
        {formatDay(points[points.length - 1].monday)}
      </SvgText>
    </Svg>
  );
}

/** El gasto que explica tu peso, frente al que calcula la app (basal + entrenos). */
function CalibrationCard({ calibration }: { calibration: Calibration }) {
  const diff = calibration.extraBurn;
  return (
    <Card tone="primarySoft">
      <ThemedText type="smallBold">Tu gasto real estimado</ThemedText>
      <ThemedText type="subtitle">{calibration.realBurn.toLocaleString('es-ES')} kcal/día</ThemedText>
      <ThemedText themeColor="textSecondary">
        La app calcula {calibration.modeledBurn.toLocaleString('es-ES')} (metabolismo basal + entrenos).{' '}
        {Math.abs(diff) < 100
          ? 'Coincide con lo que dice tu peso.'
          : diff > 0
            ? `Tu peso dice que gastas unas ${Math.abs(diff).toLocaleString('es-ES')} kcal más al día (moverte, digerir…): por eso el superávit que marcan las gráficas sale más alto que el real.`
            : `Tu peso dice que gastas unas ${Math.abs(diff).toLocaleString('es-ES')} kcal menos al día de lo que calcula la app.`}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Con {calibration.weeks} semanas de pesadas ({calibration.days} días), comiendo de media {calibration.avgIntake.toLocaleString('es-ES')} kcal. Fiabilidad {calibration.confidence}
        {calibration.confidence === 'baja' ? ': con más semanas será más fiable.' : '.'}
      </ThemedText>
    </Card>
  );
}

/** Una línea por semana con peso, la más reciente primero. */
function WeeksList({ weeks }: { weeks: TrendWeek[] }) {
  const rows = weeks.filter((w) => w.avgKg !== null).reverse();
  return (
    <View style={styles.list}>
      <ThemedText type="smallBold">Semana a semana</ThemedText>
      {rows.map((week) => (
        <Card key={week.monday} style={styles.weekCard}>
          <View style={styles.weekRow}>
            <ThemedText type="smallBold">Semana del {formatDay(week.monday)}</ThemedText>
            <ThemedText type="smallBold">{kg(week.avgKg as number)} kg</ThemedText>
          </View>
          {week.deltaKg !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {signedKg(week.deltaKg)} kg respecto a la semana anterior
              {week.predictedDeltaKg !== null
                ? ` · las kcal (${signedKcal(week.balanceKcal ?? 0)}) predicen ${signedKg(week.predictedDeltaKg)} kg`
                : ' · faltan comidas registradas para comparar'}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Primera semana con peso
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {week.weighIns} {week.weighIns === 1 ? 'pesada' : 'pesadas'} · {week.countedDays} de 7 días con comidas registradas
          </ThemedText>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  list: { gap: Spacing.two },
  weekCard: { gap: Spacing.half },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
