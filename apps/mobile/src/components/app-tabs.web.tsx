import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Hoy</TabButton>
          </TabTrigger>
          <TabTrigger name="rutinas" href="/rutinas" asChild>
            <TabButton>Rutinas</TabButton>
          </TabTrigger>
          <TabTrigger name="ejercicios" href="/ejercicios" asChild>
            <TabButton>Ejercicios</TabButton>
          </TabTrigger>
          <TabTrigger name="cuenta" href="/cuenta" asChild>
            <TabButton>Cuenta</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    // El tipo de `ref` de TabTrigger no encaja con el de Pressable; en ejecución es válido.
    <Pressable {...(props as object)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// Por debajo de este ancho las cuatro pestañas ocupan todo el espacio: sin nombre de marca.
const BRAND_MIN_WIDTH = 520;

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {width >= BRAND_MIN_WIDTH && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Trainer
          </ThemedText>
        )}

        {props.children}

      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
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
