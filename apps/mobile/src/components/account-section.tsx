import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { CoachUsageCard } from '@/components/coach-usage-card';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useCoach } from '@/lib/coach';
import { confirmAction } from '@/lib/confirm';
import { DARK_MODE_ENABLED, useThemePreference } from '@/lib/theme-preference';

/** Sesión, modo claro, catálogo de ejercicios y cerrar sesión: la parte «Mi cuenta» de «Yo». */
export function AccountSection() {
  const router = useRouter();
  const theme = useTheme();
  const { email, signOut } = useAuth();
  const { forceLight, setForceLight } = useThemePreference();
  const { messages, clearConversation } = useCoach();

  return (
    <>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Sesión iniciada con
        </ThemedText>
        <ThemedText>{email}</ThemedText>
      </Card>

      {/* El interruptor del modo oscuro solo se ofrece si el modo oscuro está activado (ver theme-preference.tsx). */}
      {DARK_MODE_ENABLED ? (
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
      ) : null}

      <CoachUsageCard />

      {messages.length > 0 ? (
        <Button
          title="Borrar conversación con el entrenador"
          variant="secondary"
          onPress={async () => {
            const ok = await confirmAction(
              'Borrar conversación',
              'Se borrará toda tu conversación con el entrenador. El entrenador seguirá conociendo tu perfil y tus datos.',
              'Borrar',
            );
            if (ok) await clearConversation().catch(() => {});
          }}
        />
      ) : null}

      <Button
        title="Catálogo de ejercicios"
        variant="secondary"
        onPress={() => router.push('/ejercicios')}
      />
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
});
