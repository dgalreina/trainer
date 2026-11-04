import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BACK_BUTTON_SIZE, BackButton } from '@/components/back-button';
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
  /** Pantalla apilada con flecha de «atrás» a la izquierda y el título centrado. */
  onBack?: () => void;
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
export function Screen({ title, subtitle, action, onBack, scroll = true, stacked, footer, fixedTop, children }: ScreenProps) {
  const bottomInset = (stacked ? Spacing.four : BottomTabInset + Spacing.four) + (footer ? FOOTER_SPACE : 0);
  const ownWaves = stacked || Platform.OS !== 'web';

  const header = onBack ? (
    <View style={styles.header}>
      <BackButton onPress={onBack} />
      <View style={[styles.headerText, styles.headerCentered]}>
        {title ? (
          <ThemedText type="subtitle" numberOfLines={1} style={styles.centeredText}>
            {title}
          </ThemedText>
        ) : null}
        {subtitle ? (
          <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.centeredText}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {/* Hueco del mismo ancho que la flecha: así el título queda centrado de verdad. */}
      <View style={{ width: BACK_BUTTON_SIZE }} />
    </View>
  ) : title || action ? (
    <View style={[styles.header, styles.headerPlain]}>
      <View style={styles.headerText}>
        {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
        {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  ) : null;

  const theme = useTheme();

  // Título y `fixedTop` quedan fijos arriba; lo único que se desplaza es el contenido.
  const hasFixed = Boolean(header || fixedTop);
  const contentStyle = [
    styles.content,
    hasFixed ? styles.afterFixedTop : null,
    { paddingBottom: bottomInset },
  ];
  // El hueco de arriba es para la barra de pestañas flotante: las pantallas apiladas no la tienen.
  const fixedStyle = [styles.content, styles.fixedTop, stacked ? styles.stackedTop : null];

  const body = (
    <SafeAreaView style={styles.safe}>
      {hasFixed ? (
        <View style={fixedStyle}>
          {header}
          {fixedTop}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentStyle}>
          {children}
        </ScrollView>
      ) : (
        <View style={[contentStyle, styles.fill]}>{children}</View>
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
  stackedTop: { paddingTop: Spacing.three },
  afterFixedTop: { paddingTop: Spacing.two },
  header: {
    flexDirection: 'row',
    // Arriba, no al centro: con subtítulo, la flecha se alinea con la línea del título.
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: { flex: 1 },
  headerPlain: { alignItems: 'flex-end' },
  headerCentered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
});
