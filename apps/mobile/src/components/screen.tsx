import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
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
  children: ReactNode;
}

/** Estructura común: ondas de fondo, título y contenido centrado. */
export function Screen({ title, subtitle, action, scroll = true, stacked, children }: ScreenProps) {
  const bottomInset = stacked ? Spacing.four : BottomTabInset + Spacing.four;
  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  );

  return (
    <ThemedView style={styles.root}>
      <Waves height={230} />
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
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
