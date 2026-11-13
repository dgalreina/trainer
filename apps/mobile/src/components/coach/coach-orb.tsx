import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TAU = Math.PI * 2;
const POINTS = 72;
/** Radio del lienzo (el viewBox va de −50 a 50). El degradado de cada capa llega hasta aquí. */
const EDGE = 46;
/** Radio de la lucecita del centro. */
const GLOW_RADIUS = 20;

/**
 * Una componente de la onda: da `lobes` abultamientos a lo largo de la vuelta, con esa amplitud, y se desplaza
 * `drift` veces por ciclo (entero, para que el movimiento se repita sin saltos; el signo es el sentido).
 */
type Harmonic = readonly [lobes: number, amplitude: number, phase: number, drift: number];

interface Layer {
  color: ThemeColor;
  radius: number;
  harmonics: readonly Harmonic[];
  opacity: number;
  /** Milisegundos que tarda en repetirse el ciclo de deformación en reposo. */
  period: number;
}

/**
 * De atrás adelante. Cada capa suma tres ondas de distinto tamaño que se desplazan a distinta velocidad y sentido, y por
 * eso su forma nunca es regular: se hincha y se hunde por sitios distintos, con suavidad.
 */
const LAYERS: readonly Layer[] = [
  { color: 'sky', radius: 34, opacity: 0.75, period: 18000, harmonics: [[2, 6, 0, 1], [3, 4, 1.2, -1], [5, 2, 2.4, 2]] },
  { color: 'teal', radius: 32, opacity: 0.7, period: 22000, harmonics: [[3, 6, 0.7, -1], [2, 5, 2, 1], [4, 3, 0.3, 2]] },
  { color: 'sky', radius: 27, opacity: 0.6, period: 15000, harmonics: [[3, 4, 1.7, -1], [2, 3, 3.5, 2], [5, 2, 0.2, -1]] },
  { color: 'lime', radius: 29, opacity: 0.5, period: 24000, harmonics: [[2, 5, 3.1, 1], [4, 3, 0.9, -2], [3, 3, 4, 1]] },
];

/** El contorno de una capa en el instante `t` (0 a 2π: un ciclo). Se calcula en el hilo de la animación. */
function shapePath(radius: number, harmonics: readonly Harmonic[], t: number): string {
  'worklet';
  let d = '';
  for (let i = 0; i <= POINTS; i++) {
    const angle = (i / POINTS) * TAU;
    let r = radius;
    for (let h = 0; h < harmonics.length; h++) {
      const [lobes, amplitude, phase, drift] = harmonics[h];
      r += amplitude * Math.sin(lobes * angle + phase + drift * t);
    }
    d += `${i === 0 ? 'M' : 'L'}${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Cuánto más deprisa se deforman cuando el entrenador está «excitado»: se le acaba de pulsar o está respondiendo. */
const EXCITED_SPEEDUP = 3.5;

function DeformingLayer({ layer, excited, still }: { layer: Layer; excited: boolean; still: boolean }) {
  const theme = useTheme();
  const gradient = `fade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const time = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(time);
      return;
    }
    // Se sigue desde el punto actual: al cambiar de velocidad la forma no salta.
    const duration = layer.period / (excited ? EXCITED_SPEEDUP : 1);
    time.value = withRepeat(withTiming(time.value + TAU, { duration, easing: Easing.linear }), -1);
    return () => cancelAnimation(time);
  }, [excited, still, layer.period, time]);

  const props = useAnimatedProps(() => ({ d: shapePath(layer.radius, layer.harmonics, time.value) }));
  const color = theme[layer.color];

  return (
    <>
      {/* El color vive en el borde y se aclara hacia el centro: lo que se ve son las ondas, no manchas. */}
      <Defs>
        <RadialGradient id={gradient} cx="0" cy="0" r={EDGE} gradientUnits="userSpaceOnUse">
          <Stop offset="0.3" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={layer.opacity} />
        </RadialGradient>
      </Defs>
      <AnimatedPath animatedProps={props} fill={`url(#${gradient})`} stroke={color} strokeWidth={1.1} strokeOpacity={0.85} />
    </>
  );
}

/**
 * El icono del entrenador: unos círculos translúcidos (azul, verde azulado y un amarillo verdoso muy suave), uno encima de otro, cuyos bordes
 * se deforman con suavidad como ondas y se cruzan y mezclan. Sin fondo, salvo una lucecita blanca en el centro. Sale del salmón de la app a propósito: es la IA.
 * En reposo se deforma despacio; con `excited` (se acaba de pulsar o está respondiendo), más deprisa. Con «reducir movimiento» se queda quieto.
 */
export function CoachOrb({ size, excited = false }: { size: number; excited?: boolean }) {
  const reduced = useReducedMotion();
  const theme = useTheme();
  const glow = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="-50 -50 100 100" style={StyleSheet.absoluteFill}>
        {LAYERS.map((layer, i) => (
          <DeformingLayer key={i} layer={layer} excited={excited} still={reduced} />
        ))}
        {/* Una lucecita blanca en el centro, por delante: si el fondo es de color, el centro se sigue viendo claro. */}
        <Defs>
          <RadialGradient id={glow} cx="0" cy="0" r={GLOW_RADIUS} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={theme.light} stopOpacity={0.9} />
            <Stop offset="1" stopColor={theme.light} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle r={GLOW_RADIUS} fill={`url(#${glow})`} />
      </Svg>
    </View>
  );
}
