import { ENERGY_SLOTS, RATE_PER_WINDOW, type DayEnergy } from '@trainer/shared';
import { useId, useMemo } from 'react';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** Cuánto de media anchura ocupa, como mucho, cada gráfica: deja un margen junto al borde. */
const MAX_FILL = 0.92;
/** Los tramos de gasto y consumo se suavizan con un núcleo triangular de este radio (en tramos). */
const SMOOTH_RADIUS = 2;

/** Opacidad de lo que ya ha pasado y de lo que aún no (esto último es proyección: se ve más tenue). */
const PAST_OPACITY = 0.5;
const FUTURE_OPACITY = 0.2;

type Point = [number, number];

/** Media móvil triangular: redondea los picos de las comidas y los entrenos sin cambiar su tamaño total. */
function smooth(values: number[], radius = SMOOTH_RADIUS): number[] {
  return values.map((_, i) => {
    let total = 0;
    let weights = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      const weight = radius + 1 - Math.abs(k);
      total += values[j] * weight;
      weights += weight;
    }
    return total / weights;
  });
}

/**
 * Dónde cae cada cosa en una gráfica (en píxeles, con la línea central en `x0`): lo usan la propia gráfica y los números
 * que se dibujan encima, para que coincidan siempre. `slot` es el tramo de 15 min (0-95).
 */
export function chartMapper(energy: DayEnergy, scale: number | null, width: number) {
  const x0 = width / 2;
  const reach = x0 * MAX_FILL;
  const kcalAtEdge = scale ?? Math.max(1, energy.peak);
  /** Píxeles (con signo) de una cantidad de kcal: la misma escala para lo comido, lo gastado y el nivel. */
  const px = (kcal: number) => Math.max(-1, Math.min(1, kcal / kcalAtEdge)) * reach;
  const intake = smooth(energy.intake);
  // El azul es lo que se gasta sin la actividad diaria; el verde, el total (con ella).
  const burn = energy.hasBurn ? smooth(energy.burn.map((v, i) => v - energy.activity[i])) : null;
  const burnAll = energy.hasBurn ? smooth(energy.burn) : null;
  return {
    x0,
    reach,
    px,
    pinkX: (slot: number) => x0 + px(intake[slot] * RATE_PER_WINDOW),
    blueX: (slot: number) => (burn ? x0 - px(burn[slot] * RATE_PER_WINDOW) : x0),
    tealX: (slot: number) => (burnAll ? x0 - px(burnAll[slot] * RATE_PER_WINDOW) : x0),
    amberX: (slot: number) => x0 + px(energy.level[slot]),
  };
}

/** Lado de la línea central en el que debe quedarse una gráfica: la curva no puede cruzarla. */
interface Side {
  x0: number;
  sign: 1 | -1;
}

/**
 * Curva suave (Catmull-Rom convertida a Bézier) que pasa por todos los puntos. Con `side`, los puntos de
 * control se acotan a ese lado de la línea central: el suavizado no rebasa el cero tras un salto brusco.
 */
function curve(points: Point[], side?: Side): string {
  const keep = (x: number) => (side ? (side.sign > 0 ? Math.max(side.x0, x) : Math.min(side.x0, x)) : x);
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C${keep(p1[0] + (p2[0] - p0[0]) / 6)},${p1[1] + (p2[1] - p0[1]) / 6} ${keep(p2[0] - (p3[0] - p1[0]) / 6)},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Área entre una curva y la línea central `x0`, cerrada por arriba y por abajo. */
function area(points: Point[], x0: number, side?: Side): string {
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve(points, side)} L${x0},${last[1]} L${x0},${first[1]} Z`;
}

/**
 * Las gráficas del día, detrás de las horas: una línea vertical central (el cero de calorías), el gasto en
 * azul a la izquierda, lo comido en rosa a la derecha y el balance acumulado en amarillo anaranjado, que
 * cruza la línea según se va gastando o comiendo. Los tres comparten escala (kcal → píxeles; lo comido y gastado, en
 * kcal cada 30 min) y la escala la fija `scale`. Lo que aún no ha pasado se dibuja más tenue.
 */
export function DayEnergyChart({
  energy,
  scale,
  width,
  height,
  dimFrom,
}: {
  energy: DayEnergy;
  /** kcal que llegan al borde: la misma para todos los días; sin ella, lo más grande del día. */
  scale: number | null;
  width: number;
  height: number;
  /** Altura (px) a partir de la cual el día es proyección y se dibuja más tenue. */
  dimFrom: number;
}) {
  const theme = useTheme();
  // Ids únicos por instancia: los degradados y recortes son globales en el documento.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = { blue: `energy-blue-${uid}`, teal: `energy-teal-${uid}`, amber: `energy-amber-${uid}`, pink: `energy-pink-${uid}`, past: `energy-past-${uid}`, future: `energy-future-${uid}` };

  const shapes = useMemo(() => {
    const { x0, reach, px } = chartMapper(energy, scale, width);
    const slotHeight = height / ENERGY_SLOTS;
    const centerY = (i: number) => (i + 0.5) * slotHeight;

    const intake = smooth(energy.intake);
    const burn = energy.hasBurn ? smooth(energy.burn) : null;
    // Lo que se gasta sin la actividad diaria (basal + entrenos): el azul; la actividad se dibuja aparte, en verde, por fuera.
    const burnCore = energy.hasBurn ? smooth(energy.burn.map((v, i) => v - energy.activity[i])) : null;
    const hasActivity = energy.totals.activity > 0;
    // Una sola escala (kcal → píxeles) para todo: lo comido y lo gastado (kcal cada 30 min) y el nivel acumulado, y la misma
    // en todos los días (si no, a medianoche habría un escalón).

    // Los extremos repiten el primer y el último valor, y la curva llega hasta el borde del día.
    const side = (values: number[], sign: 1 | -1): Point[] => {
      const body = values.map((v, i): Point => [x0 + sign * px(v * RATE_PER_WINDOW), centerY(i)]);
      return [[body[0][0], 0], ...body, [body[body.length - 1][0], height]];
    };

    // El día empieza ya en el nivel que dejó el anterior (no en el centro): así no hay corte a medianoche.
    const balancePoints: Point[] = [
      [x0 + px(energy.level[0]), 0],
      ...energy.level.map((v, i): Point => [x0 + px(v), (i + 1) * slotHeight]),
    ];

    return {
      x0,
      pink: side(intake, 1),
      blue: burnCore ? side(burnCore, -1) : null,
      teal: burn && hasActivity ? side(burn, -1) : null,
      balance: energy.hasBurn ? balancePoints : null,
    };
  }, [energy, scale, width, height]);

  if (width <= 0) return null;
  const { x0 } = shapes;
  const reach = (width / 2) * MAX_FILL;
  const leftSide: Side = { x0, sign: -1 };
  const rightSide: Side = { x0, sign: 1 };
  const dim = Math.min(Math.max(dimFrom, 0), height);

  const drawing = (
    <>
      {/* Las áreas: degradado que se aviva hacia el borde, como las ondas de la cabecera. */}
      {/* El borde va aparte del área: si no, también se pintaría a lo largo de la línea central. */}
      {/* El balance va el primero: queda por detrás del azul y del rosa. */}
      {shapes.balance && (
        <>
          <Path d={area(shapes.balance, x0)} fill={`url(#${ids.amber})`} />
          <Path d={curve(shapes.balance)} fill="none" stroke={theme.amber} strokeWidth={2} strokeOpacity={0.75} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {/* La actividad diaria (moverte, digerir…): el total del gasto, en verde, detrás del azul, que es lo que no depende de ti. */}
      {shapes.teal && (
        <>
          <Path d={area(shapes.teal, x0, leftSide)} fill={`url(#${ids.teal})`} />
          <Path d={curve(shapes.teal, leftSide)} fill="none" stroke={theme.teal} strokeWidth={1.5} strokeOpacity={0.8} />
        </>
      )}
      {shapes.blue && (
        <>
          <Path d={area(shapes.blue, x0, leftSide)} fill={`url(#${ids.blue})`} />
          <Path d={curve(shapes.blue, leftSide)} fill="none" stroke={theme.sky} strokeWidth={1.5} strokeOpacity={0.8} />
        </>
      )}
      <Path d={area(shapes.pink, x0, rightSide)} fill={`url(#${ids.pink})`} />
      <Path d={curve(shapes.pink, rightSide)} fill="none" stroke={theme.primary} strokeWidth={1.5} strokeOpacity={0.8} />
    </>
  );

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        {/* En coordenadas del dibujo: la intensidad depende de la distancia a la línea central, no del tamaño de cada forma. */}
        <LinearGradient id={ids.blue} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x0 - reach} y2={0}>
          <Stop offset="0" stopColor={theme.sky} stopOpacity={0.12} />
          <Stop offset="1" stopColor={theme.sky} stopOpacity={0.5} />
        </LinearGradient>
        <LinearGradient id={ids.teal} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x0 - reach} y2={0}>
          <Stop offset="0" stopColor={theme.teal} stopOpacity={0.12} />
          <Stop offset="1" stopColor={theme.teal} stopOpacity={0.45} />
        </LinearGradient>
        <LinearGradient id={ids.pink} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x0 + reach} y2={0}>
          <Stop offset="0" stopColor={theme.pink} stopOpacity={0.12} />
          <Stop offset="1" stopColor={theme.primary} stopOpacity={0.5} />
        </LinearGradient>
        {/* El balance cruza la línea central: más suave junto a ella y más vivo hacia los lados, sin llegar a blanco. */}
        <LinearGradient id={ids.amber} gradientUnits="userSpaceOnUse" x1={x0 - reach} y1={0} x2={x0 + reach} y2={0}>
          <Stop offset="0" stopColor={theme.amber} stopOpacity={0.34} />
          <Stop offset="0.5" stopColor={theme.amber} stopOpacity={0.12} />
          <Stop offset="1" stopColor={theme.amber} stopOpacity={0.34} />
        </LinearGradient>
        <ClipPath id={ids.past}>
          <Rect x={0} y={0} width={width} height={dim} />
        </ClipPath>
        <ClipPath id={ids.future}>
          <Rect x={0} y={dim} width={width} height={Math.max(0, height - dim)} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${ids.past})`} opacity={PAST_OPACITY}>
        {drawing}
      </G>
      <G clipPath={`url(#${ids.future})`} opacity={FUTURE_OPACITY}>
        {drawing}
      </G>
      {/* La línea central: el cero de calorías. */}
      <Rect x={x0 - 0.5} y={0} width={1} height={height} fill={theme.textSecondary} fillOpacity={0.35} />
    </Svg>
  );
}
