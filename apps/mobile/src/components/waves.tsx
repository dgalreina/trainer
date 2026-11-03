import { useIsFocused } from 'expo-router';
import { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const WIDTH = 400;
// Con la animación se redibuja la curva a cada fotograma: pasos más grandes que en
// estático, pero a este tamaño de pantalla la curva se sigue viendo lisa.
const STEP = 4;
// ~30 fotogramas por segundo: el movimiento es lento y no necesita más (ahorra batería).
const FRAME_MS = 33;

interface WaveLayer {
  /** Altura media de la onda, de 0 a 1 sobre el alto total. */
  base: number;
  amplitude: number;
  /** Ciclos completos a lo ancho. */
  cycles: number;
  phase: number;
  /** Radianes por segundo; el signo fija el sentido. Capas distintas, velocidades y sentidos distintos. */
  speed: number;
  from: ThemeColor;
  to: ThemeColor;
  opacity: number;
  /** Opacidad de cada extremo del degradado (por defecto, 1): sirve para desvanecer un color sin mezclarlo con otro. */
  fromAlpha?: number;
  toAlpha?: number;
}

// Capas solapadas con degradado horizontal: la identidad visual de la app.
// Dominan el salmón y el rosa, con melocotón para dar calidez. El azul cielo solo
// asoma como un matiz aparte, desvaneciéndose: mezclarlo con el salmón lo vuelve malva.
// Pocos ciclos y mucha amplitud: ondas anchas y redondeadas, no un rizado.
// Se mueven despacio y en sentidos opuestos, para que parezca agua y no una cinta.
const LAYERS: WaveLayer[] = [
  { base: 0.78, amplitude: 0.12, cycles: 0.9, phase: 1.3, speed: 0.3, from: 'sky', to: 'sky', opacity: 0.3, fromAlpha: 0, toAlpha: 1 },
  { base: 0.66, amplitude: 0.16, cycles: 0.85, phase: 0.6, speed: -0.42, from: 'orange', to: 'pink', opacity: 0.3 },
  { base: 0.54, amplitude: 0.17, cycles: 1.1, phase: 2.4, speed: 0.55, from: 'pink', to: 'primary', opacity: 0.34 },
  { base: 0.42, amplitude: 0.15, cycles: 1.45, phase: 4.1, speed: -0.35, from: 'primary', to: 'orange', opacity: 0.28 },
];

/** Área que cuelga del borde superior hasta una curva suave. `time` en segundos. */
function wavePath(height: number, layer: WaveLayer, time: number): string {
  let d = `M0,0 L0,${curveY(0, height, layer, time)}`;
  for (let x = STEP; x <= WIDTH; x += STEP) {
    d += ` L${x},${curveY(x, height, layer, time)}`;
  }
  return `${d} L${WIDTH},0 Z`;
}

function curveY(
  x: number,
  height: number,
  { base, amplitude, cycles, phase, speed }: WaveLayer,
  time: number,
): number {
  const t = (x / WIDTH) * Math.PI * 2 * cycles + phase + speed * time;
  // Un segundo armónico muy suave evita una sinusoide perfecta sin perder redondez.
  const wave = Math.sin(t) + 0.12 * Math.sin(t * 1.7 + 1);
  return (base + (amplitude * wave) / 1.12) * height;
}

/**
 * Tiempo de animación en segundos. Avanza solo mientras `active`; al pausarse conserva
 * el punto en que estaba, para que al volver la onda continúe en lugar de saltar.
 */
function useWaveTime(active: boolean): number {
  const [time, setTime] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      if (now - previous >= FRAME_MS) {
        elapsed.current += (now - previous) / 1000;
        previous = now;
        setTime(elapsed.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return time;
}

/**
 * Ondas decorativas con degradado para cabeceras. No captan toques. Se mueven despacio,
 * salvo que el usuario pida reducir el movimiento o la pantalla no esté a la vista.
 */
export function Waves({ height = 200, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  // Sobre fondo oscuro los mismos colores pesan mucho más y se vuelven turbios: se atenúan.
  const intensity = useColorScheme() === 'dark' ? 0.5 : 1;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const time = useWaveTime(focused && !reduceMotion);

  return (
    <View pointerEvents="none" style={[styles.container, { height }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none">
        <Defs>
          {LAYERS.map((layer, i) => (
            <LinearGradient key={i} id={`${uid}-${i}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme[layer.from]} stopOpacity={layer.fromAlpha ?? 1} />
              <Stop offset="1" stopColor={theme[layer.to]} stopOpacity={layer.toAlpha ?? 1} />
            </LinearGradient>
          ))}
        </Defs>
        {LAYERS.map((layer, i) => (
          <Path
            key={i}
            d={wavePath(height, layer, time)}
            fill={`url(#${uid}-${i})`}
            fillOpacity={layer.opacity * intensity}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0 },
});
