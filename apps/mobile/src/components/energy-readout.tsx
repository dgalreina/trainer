import { ENERGY_SLOTS, ENERGY_SLOT_MINUTES, MEAL_SPREAD_MINUTES, type DayEnergy } from '@trainer/shared';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { chartMapper } from '@/components/day-energy-chart';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Una comida del día para poner su número: cuándo empieza y cuántas kcal tiene. */
export interface ReadoutMeal {
  at: number;
  kcal: number;
}

const MINUTE_MS = 60_000;
/** Ancho aproximado de un número pequeño («+1.250»), para saber si cabe a la derecha de la curva. */
const LABEL_WIDTH = 40;
const LABEL_HEIGHT = 12;
/** Un pico o valle del nivel solo se numera si se aleja al menos esto (kcal) del anterior numerado: así no salen números por ruido. */
const MIN_EXTREMUM_STEP = 150;

/** «+926», «−300», «0»: con signo, con el separador de miles de España y sin decimales. */
export function signed(kcal: number): string {
  const rounded = Math.round(kcal);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('es-ES')}`;
}

interface Label {
  key: string;
  text: string;
  /** Punto de la curva al que acompaña (px dentro del área de la gráfica). */
  x: number;
  y: number;
  tone: 'pink' | 'amber';
}

/**
 * Números pequeños sobre la gráfica, siempre visibles: en rosa lo que aporta cada comida, en amarillo oscuro el nivel en
 * cada pico y cada valle. Se colocan junto a la curva (a su derecha si cabe, si no a su izquierda) y, si dos se pisan, se
 * queda el primero (las comidas van antes que los picos y valles).
 */
export function EnergyLabels({
  energy,
  scale,
  width,
  height,
  dayStart,
  meals,
  dimFrom,
}: {
  energy: DayEnergy;
  scale: number | null;
  width: number;
  height: number;
  dayStart: number;
  meals: ReadoutMeal[];
  /** Altura (px) desde la que el día es proyección: sus números se ven más tenues. */
  dimFrom: number;
}) {
  const theme = useTheme();
  const labels = useMemo(() => {
    const map = chartMapper(energy, scale, width);
    const slotHeight = height / ENERGY_SLOTS;
    const slotMs = ENERGY_SLOT_MINUTES * MINUTE_MS;
    const found: Label[] = [];

    // Cada comida, a la altura del medio de los 30 min en que se reparte.
    for (const meal of meals) {
      const slot = Math.floor((meal.at + (MEAL_SPREAD_MINUTES / 2) * MINUTE_MS - dayStart) / slotMs);
      if (slot < 0 || slot >= ENERGY_SLOTS || meal.kcal <= 0) continue;
      found.push({ key: `meal-${meal.at}`, text: signed(meal.kcal), x: map.pinkX(slot), y: (slot + 0.5) * slotHeight, tone: 'pink' });
    }

    // Los picos y valles del nivel, sin ruido.
    if (energy.hasBurn) {
      let last: number | null = null;
      for (let i = 1; i < ENERGY_SLOTS - 1; i++) {
        const [before, now, after] = [energy.level[i - 1], energy.level[i], energy.level[i + 1]];
        const extremum = (now > before && now >= after) || (now < before && now <= after);
        if (!extremum || (last !== null && Math.abs(now - last) < MIN_EXTREMUM_STEP)) continue;
        last = now;
        found.push({ key: `level-${i}`, text: signed(now), x: map.amberX(i), y: (i + 0.5) * slotHeight, tone: 'amber' });
      }
    }

    // Sin pisarse: se descarta el que quede encima de otro ya colocado.
    const kept: (Label & { left: number; align: 'left' | 'right' })[] = [];
    for (const label of found) {
      const fitsRight = label.x + 4 + LABEL_WIDTH <= width;
      const left = fitsRight ? label.x + 4 : Math.max(0, label.x - 4 - LABEL_WIDTH);
      const clash = kept.some(
        (k) => Math.abs(k.y - label.y) < LABEL_HEIGHT && left < k.left + LABEL_WIDTH && k.left < left + LABEL_WIDTH,
      );
      if (!clash) kept.push({ ...label, left, align: fitsRight ? 'left' : 'right' });
    }
    return kept;
  }, [energy, scale, width, height, dayStart, meals]);

  return (
    <>
      {labels.map((label) => (
        <ThemedText
          key={label.key}
          type="smallBold"
          numberOfLines={1}
          style={[
            styles.label,
            {
              left: label.left,
              top: label.y - LABEL_HEIGHT / 2,
              color: label.tone === 'pink' ? theme.primaryText : theme.amberDeep,
              textAlign: label.align,
              opacity: label.y >= dimFrom ? 0.55 : 1,
            },
          ]}>
          {label.text}
        </ThemedText>
      ))}
    </>
  );
}

/**
 * Lo que se ve al mantener el dedo sobre la gráfica y moverlo: una línea a esa altura con un punto azul (lo que se gasta,
 * en kcal por hora), uno rosa (la comida que se está comiendo a esa hora, o 0) y uno amarillo (el nivel), y una pequeña
 * tarjeta con la hora y los tres números. Va por encima de todo y no capta toques.
 */
export function ScrubReadout({
  y,
  energy,
  scale,
  width,
  height,
  dayStart,
  meals,
  hourLabel,
}: {
  /** Altura (px) del dedo dentro del día. */
  y: number;
  energy: DayEnergy;
  scale: number | null;
  width: number;
  height: number;
  dayStart: number;
  meals: ReadoutMeal[];
  /** La hora «HH:MM» de ese punto. */
  hourLabel: (slotStart: Date) => string;
}) {
  const theme = useTheme();
  const map = chartMapper(energy, scale, width);
  const slot = Math.min(Math.max(Math.floor((y / height) * ENERGY_SLOTS), 0), ENERGY_SLOTS - 1);
  const lineY = Math.min(Math.max(y, 0), height);
  const moment = dayStart + slot * ENERGY_SLOT_MINUTES * MINUTE_MS;

  const burnPerHour = energy.hasBurn ? energy.burn[slot] * (60 / ENERGY_SLOT_MINUTES) : null;
  const meal = meals.find((m) => moment >= m.at && moment < m.at + MEAL_SPREAD_MINUTES * MINUTE_MS);
  const level = energy.level[slot];

  const rows: { color: string; text: string }[] = [
    { color: theme.sky, text: burnPerHour === null ? '—' : `−${Math.round(burnPerHour).toLocaleString('es-ES')} kcal/h` },
    { color: theme.primary, text: `${meal ? signed(meal.kcal) : '0'} kcal` },
    { color: theme.amber, text: `${signed(level)} kcal` },
  ];
  // La tarjeta va encima de la línea (el dedo está debajo) y, si no cabe arriba, debajo.
  const cardTop = lineY > 130 ? lineY - 116 : lineY + 18;

  return (
    <View pointerEvents="none" style={styles.readout}>
      <View style={[styles.line, { top: lineY - 0.5, backgroundColor: theme.text }]} />
      {[
        { x: map.blueX(slot), color: theme.sky },
        { x: map.pinkX(slot), color: theme.primary },
        { x: map.amberX(slot), color: theme.amber },
      ].map((dot) => (
        <View key={dot.color} style={[styles.dot, { left: dot.x - 5, top: lineY - 5, backgroundColor: dot.color, borderColor: theme.background }]} />
      ))}
      <View style={[styles.card, { top: cardTop, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{hourLabel(new Date(moment))}</ThemedText>
        {rows.map((row) => (
          <View key={row.color} style={styles.cardRow}>
            <View style={[styles.cardDot, { backgroundColor: row.color }]} />
            <ThemedText type="small">{row.text}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', width: LABEL_WIDTH, fontSize: 10, lineHeight: LABEL_HEIGHT, ...({ pointerEvents: 'none' } as object) },
  readout: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 20 },
  line: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.35 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -66,
    width: 132,
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardDot: { width: 8, height: 8, borderRadius: 4 },
});
