import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ExercisesProvider } from '@/lib/exercises';
import { RoutinesProvider } from '@/lib/routines';

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
        <Stack.Screen name="rutina/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
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
          <RoutinesProvider>
            <AnimatedSplashOverlay />
            <RootNavigator />
          </RoutinesProvider>
        </ExercisesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
