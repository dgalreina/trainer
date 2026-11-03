import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const WIDTH = 400;
const STEP = 2;

interface WaveLayer {
  /** Altura media de la onda, de 0 a 1 sobre el alto total. */
  base: number;
  amplitude: number;
  /** Ciclos completos a lo ancho. */
  cycles: number;
  phase: number;
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
const LAYERS: WaveLayer[] = [
  { base: 0.78, amplitude: 0.12, cycles: 0.9, phase: 1.3, from: 'sky', to: 'sky', opacity: 0.3, fromAlpha: 0, toAlpha: 1 },
  { base: 0.66, amplitude: 0.16, cycles: 0.85, phase: 0.6, from: 'orange', to: 'pink', opacity: 0.3 },
  { base: 0.54, amplitude: 0.17, cycles: 1.1, phase: 2.4, from: 'pink', to: 'primary', opacity: 0.34 },
  { base: 0.42, amplitude: 0.15, cycles: 1.45, phase: 4.1, from: 'primary', to: 'orange', opacity: 0.28 },
];

/** Área que cuelga del borde superior hasta una curva suave. */
function wavePath(height: number, layer: WaveLayer): string {
  let d = `M0,0 L0,${curveY(0, height, layer)}`;
  for (let x = STEP; x <= WIDTH; x += STEP) {
    d += ` L${x},${curveY(x, height, layer)}`;
  }
  return `${d} L${WIDTH},0 Z`;
}

function curveY(x: number, height: number, { base, amplitude, cycles, phase }: WaveLayer): number {
  const t = (x / WIDTH) * Math.PI * 2 * cycles + phase;
  // Un segundo armónico muy suave evita una sinusoide perfecta sin perder redondez.
  const wave = Math.sin(t) + 0.12 * Math.sin(t * 1.7 + 1);
  return (base + (amplitude * wave) / 1.12) * height;
}

/** Ondas decorativas con degradado para cabeceras. No captan toques. */
export function Waves({ height = 200, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  // Sobre fondo oscuro los mismos colores pesan mucho más y se vuelven turbios: se atenúan.
  const intensity = useColorScheme() === 'dark' ? 0.5 : 1;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

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
            d={wavePath(height, layer)}
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
