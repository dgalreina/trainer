import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useThemePreference } from '@/lib/theme-preference';

export function AccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { email, signOut } = useAuth();
  const { forceLight, setForceLight } = useThemePreference();

  return (
    <Screen title="Cuenta">
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Sesión iniciada con
        </ThemedText>
        <ThemedText>{email}</ThemedText>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">Usar siempre modo claro</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {forceLight
                ? 'La app se ve siempre en claro.'
                : 'Desactivado: la app sigue el modo de tu móvil.'}
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel="Usar siempre modo claro"
            value={forceLight}
            onValueChange={setForceLight}
            trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
            thumbColor="#FFFFFF"
            // En la web el pulgar encendido usa `activeThumbColor` y, si no, sale verde.
            {...({ activeThumbColor: '#FFFFFF' } as object)}
          />
        </View>
      </Card>

      <Button
        title="Catálogo de ejercicios"
        variant="secondary"
        onPress={() => router.push('/ejercicios')}
      />
      <Button
        title="Catálogo de ejercicios"
        variant="secondary"
        onPress={() => router.push('/ejercicios')}
      />
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
});
