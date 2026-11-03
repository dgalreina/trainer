import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Waves } from '@/components/waves';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  WebTabBarInset,
} from '@/constants/theme';

interface ScreenProps {
  title: string;
  subtitle?: string;
  /** Contenido a la derecha del título (por ejemplo, un botón). */
  action?: ReactNode;
  /** false si el contenido gestiona su propio scroll (una FlatList). */
  scroll?: boolean;
  /** true en pantallas fuera de las pestañas: sin hueco para la barra inferior. */
  stacked?: boolean;
  /**
   * Posición de la pestaña, de izquierda a derecha. Al cambiar de pestaña el contenido
   * entra deslizándose desde el lado hacia el que te mueves.
   */
  tabIndex?: number;
  children: ReactNode;
}

// Última pestaña que se vio: da la dirección del deslizamiento al cambiar.
let lastTabIndex: number | null = null;

// Devuelve la pestaña anterior y registra la nueva. Va en una función aparte porque
// leer y escribir la variable de módulo dentro del efecto se reordenaba al compilar
// (la "anterior" salía siempre igual a la actual y nunca había animación).
function swapLastTab(next: number): number | null {
  const previous = lastTabIndex;
  lastTabIndex = next;
  return previous;
}

const SLIDE_MS = 360;
const FADE_MS = 260;
const MAX_SLIDE = 240;

/** Al ganar el foco, el contenido entra desde el lado hacia el que te mueves por las pestañas. */
function useTabSlide(tabIndex: number | undefined) {
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!focused || tabIndex === undefined) return;
    const previous = swapLastTab(tabIndex);
    // La primera pestaña que se abre, o quien pide menos movimiento, no se anima.
    if (previous === null || previous === tabIndex || reduceMotion) return;

    const direction = tabIndex > previous ? 1 : -1;
    translateX.value = direction * Math.min(width * 0.5, MAX_SLIDE);
    opacity.value = 0;
    translateX.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: FADE_MS });
  }, [focused, tabIndex, reduceMotion, width, translateX, opacity]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));
}

/**
 * Estructura común: título y contenido centrado. En las pestañas de la web las ondas de
 * fondo las pone el layout una sola vez, para que sigan ondeando mientras el contenido
 * se desliza; en el resto (móvil nativo, pantallas fuera de las pestañas) las pone cada pantalla.
 */
export function Screen({ title, subtitle, action, scroll = true, stacked, tabIndex, children }: ScreenProps) {
  const bottomInset = stacked ? Spacing.four : BottomTabInset + Spacing.four;
  const ownWaves = stacked || Platform.OS !== 'web';
  const slide = useTabSlide(tabIndex);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  );

  const body = (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, { paddingBottom: bottomInset }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );

  if (!ownWaves) {
    // Fondo transparente: se ven las ondas del layout.
    return <Animated.View style={[styles.root, slide]}>{body}</Animated.View>;
  }

  return (
    <ThemedView style={styles.root}>
      <Waves height={230} />
      <Animated.View style={[styles.slide, slide]}>{body}</Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  slide: { flex: 1, width: '100%', alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? WebTabBarInset : Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerText: { flex: 1 },
});
