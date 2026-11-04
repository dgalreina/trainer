import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { TabsPager } from '@/components/tabs-pager';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { TABS, tabIndexFromPath } from '@/lib/tabs';

// Por debajo de este ancho las cinco pestañas ocupan todo el espacio: sin nombre de marca.
const BRAND_MIN_WIDTH = 520;

/**
 * Pestañas de la web: el paginador con las cinco pantallas y la barra flotante encima.
 * No usan el navegador de pestañas de Expo porque este solo muestra una pantalla a la vez,
 * y aquí hacen falta todas juntas para poder deslizarlas.
 */
export default function AppTabs() {
  return (
    <View style={styles.root}>
      <TabsPager />
      <TabBar />
    </View>
  );
}

function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const active = tabIndexFromPath(pathname);

  return (
    <View style={styles.tabListContainer} pointerEvents="box-none">
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {width >= BRAND_MIN_WIDTH && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Élite Trainer
          </ThemedText>
        )}

        {TABS.map((tab, i) => {
          const focused = i === active;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => router.navigate(tab.path)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type={focused ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tabButtonView}>
                <ThemedText type="small" themeColor={focused ? 'text' : 'textSecondary'}>
                  {tab.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    justifyContent: 'space-between',
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + 4,
    borderRadius: Spacing.three,
  },
});
