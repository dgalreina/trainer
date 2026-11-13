/**
 * Tokens de tema. Predomina el blanco, con el salmón/rosa como color de la app y
 * acentos en azul cielo y azul verdoso (el naranja, solo en último caso). La paleta fina se decidirá más adelante: las pantallas usan estos nombres,
 * nunca colores sueltos, así que cambiarla es tocar solo este fichero.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2B2024',
    textSecondary: '#8A7378',
    background: '#FFFFFF',
    backgroundElement: '#FFF6F4',
    backgroundSelected: '#FFE8E3',
    /** Salmón: el color de la app (acción principal, ingesta). */
    primary: '#FF8F7E',
    primarySoft: '#FFEBE6',
    /** Salmón más profundo para texto y enlaces (el color base no tiene contraste sobre blanco). */
    primaryText: '#C8503F',
    /** Texto sobre `primary`: oscuro, para tener contraste suficiente sobre el salmón claro. */
    onPrimary: '#2B2024',
    /** Rosa: matiz cercano al salmón, para degradados. */
    pink: '#FFA9BA',
    /** Melocotón/naranja suave: último recurso, para el balance acumulado. */
    orange: '#FFB98A',
    /** Amarillo anaranjado: el balance acumulado del día en las gráficas del calendario. */
    amber: '#FFB020',
    /** Amarillo anaranjado más oscuro: los números pequeños del nivel sobre la gráfica (el base no se lee sobre blanco). */
    amberDeep: '#B7791F',
    /** Azul cielo y azul verdoso: acentos, sobre todo el gasto de calorías. */
    sky: '#8ED3F2',
    /** Azul cielo muy suave: fondo de lo que es gasto (los entrenos en el calendario). */
    skySoft: '#E6F5FC',
    teal: '#6FD3C8',
    /** Amarillo verdoso suave: una de las ondas del icono del entrenador. */
    lime: '#D4E58A',
    /** Blanco luz (también en modo oscuro): la lucecita del centro del icono del entrenador. */
    light: '#FFFFFF',
    /** Todo lo de la IA es azulado y verdoso (no salmón): verde azulado muy suave para fondos... */
    tealSoft: '#E4F7F4',
    /** ...y azul verdoso oscuro para el texto y los enlaces de la IA (el color base no tiene contraste sobre blanco). */
    aiText: '#1F7C8A',
    danger: '#D93B3B',
    dangerSoft: '#FDE4E4',
    /** Blanco translúcido, para elementos que dejan ver las ondas de detrás. */
    glass: 'rgba(255, 255, 255, 0.55)',
    glassBorder: 'rgba(255, 255, 255, 0.85)',
  },
  dark: {
    text: '#FBEFEC',
    textSecondary: '#C2ABA7',
    background: '#150F12',
    backgroundElement: '#221A1E',
    backgroundSelected: '#2E2328',
    primary: '#FF9E8F',
    primarySoft: '#3A2523',
    primaryText: '#FF9E8F',
    onPrimary: '#2B2024',
    pink: '#FFB3C2',
    orange: '#FFC49A',
    amber: '#FFC04D',
    amberDeep: '#FFC04D',
    sky: '#8ED3F2',
    skySoft: '#1E3039',
    teal: '#6FD3C8',
    lime: '#D4E58A',
    light: '#FFFFFF',
    tealSoft: '#1E3A38',
    aiText: '#7FD9E0',
    danger: '#FF6B6B',
    dangerSoft: '#3F2224',
    glass: 'rgba(255, 255, 255, 0.10)',
    glassBorder: 'rgba(255, 255, 255, 0.22)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 20,
  control: 14,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
/** En la web la barra de pestañas va arriba, superpuesta al contenido. */
export const WebTabBarInset = 88;
