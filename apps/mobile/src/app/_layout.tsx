import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ExercisesProvider } from '@/lib/exercises';
import { SettingsProvider } from '@/lib/settings';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';
import { TrainingsProvider } from '@/lib/trainings';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  // Mientras se recupera la sesión guardada no se decide a qué pantalla ir.
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entrenamiento/[id]/index" />
        <Stack.Screen name="entrenamiento/[id]/rutina/[rid]" />
        <Stack.Screen name="ejercicios" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

function ThemedApp() {
  const dark = useColorScheme() === 'dark';
  const { forceLight } = useThemePreference();
  const colors = Colors[dark ? 'dark' : 'light'];

  // En la web, el fondo de la página y el esquema de color del navegador siguen a la app:
  // si no, con el modo claro forzado en un móvil oscuro asomaría una franja oscura (rebote,
  // zonas seguras) y el navegador pintaría sus controles en oscuro.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    root.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
    root.style.colorScheme = forceLight ? 'light' : 'light dark';
  }, [colors.background, forceLight]);

  // El tema de navegación sale de nuestros tokens, no del de Expo.
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      primary: colors.primary,
      border: colors.backgroundSelected,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ExercisesProvider>
          <TrainingsProvider>
            <SettingsProvider>
              <AnimatedSplashOverlay />
              <RootNavigator />
            </SettingsProvider>
          </TrainingsProvider>
        </ExercisesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedApp />
    </ThemePreferenceProvider>
  );
}
