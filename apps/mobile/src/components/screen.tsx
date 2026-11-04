import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Waves } from '@/components/waves';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  WebTabBarInset,
} from '@/constants/theme';

interface ScreenProps {
  /** Sin título (y sin acción) la pantalla no lleva cabecera: más sitio para el contenido. */
  title?: string;
  subtitle?: string;
  /** Contenido a la derecha del título (por ejemplo, un botón). */
  action?: ReactNode;
  /** false si el contenido gestiona su propio scroll (una FlatList). */
  scroll?: boolean;
  /** true en pantallas fuera de las pestañas: sin hueco para la barra inferior. */
  stacked?: boolean;
  /** Contenido fijo arriba, bajo la barra de pestañas: no se desplaza con el resto. */
  fixedTop?: ReactNode;
  /** Barra fija abajo (por ejemplo, el botón Finalizar de un entreno). */
  footer?: ReactNode;
  children: ReactNode;
}

// Hueco que se deja bajo el contenido para que la barra fija no tape lo último.
const FOOTER_SPACE = 200;

/**
 * Estructura común: título y contenido centrado. En las pestañas de la web las ondas de
 * fondo las pone el layout una sola vez (el paginador desliza las pantallas por encima
 * mientras ellas siguen ondeando); en el resto (móvil nativo, pantallas fuera de las
 * pestañas) las pone cada pantalla.
 */
export function Screen({ title, subtitle, action, scroll = true, stacked, footer, fixedTop, children }: ScreenProps) {
  const bottomInset = (stacked ? Spacing.four : BottomTabInset + Spacing.four) + (footer ? FOOTER_SPACE : 0);
  const ownWaves = stacked || Platform.OS !== 'web';

  const header =
    title || action ? (
      <View style={styles.header}>
        <View style={styles.headerText}>
          {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
          {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
        </View>
        {action}
      </View>
    ) : null;

  const theme = useTheme();

  const body = (
    <SafeAreaView style={styles.safe}>
      {fixedTop ? <View style={[styles.content, styles.fixedTop]}>{fixedTop}</View> : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            fixedTop ? styles.afterFixedTop : null,
            { paddingBottom: bottomInset },
          ]}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            styles.fill,
            fixedTop ? styles.afterFixedTop : null,
            { paddingBottom: bottomInset },
          ]}>
          {header}
          {children}
        </View>
      )}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: theme.background }]}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );

  // Fondo transparente: se ven las ondas del layout.
  if (!ownWaves) return <View style={styles.root}>{body}</View>;

  return (
    <ThemedView style={styles.root}>
      <Waves height={230} />
      {body}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  fill: { flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? WebTabBarInset : Spacing.four,
    gap: Spacing.three,
  },
  fixedTop: { paddingBottom: Spacing.two },
  afterFixedTop: { paddingTop: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerText: { flex: 1 },
});
