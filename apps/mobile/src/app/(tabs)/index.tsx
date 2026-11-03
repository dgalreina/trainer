import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExercises } from '@/lib/exercises';
import { routineSummary } from '@/lib/routine-summary';
import { useRoutines } from '@/lib/routines';

function todayLabel(): string {
  const text = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function TodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { routines, loading, error } = useRoutines();
  const { byId } = useExercises();

  const openRoutine = (id: string) => router.push({ pathname: '/rutina/[id]', params: { id } });

  return (
    <Screen tabIndex={0} title="Hoy" subtitle={todayLabel()}>
      <ErrorText message={error} />

      {loading && routines.length === 0 ? (
        <ActivityIndicator color={theme.primary} />
      ) : routines.length === 0 ? (
        <Card tone="primarySoft" style={styles.empty}>
          <ThemedText type="smallBold">Aún no tienes entrenamiento</ThemedText>
          <ThemedText themeColor="textSecondary">
            Pronto podrás hablar con tu entrenador y te preparará uno según lo que necesites.
            Mientras tanto, puedes crear tu primera rutina a mano.
          </ThemedText>
          <Button title="Crear una rutina" onPress={() => router.push('/rutina/nueva')} />
        </Card>
      ) : (
        <>
          <ThemedText type="smallBold">¿Qué entrenas hoy?</ThemedText>
          {routines.map((routine) => {
            const summary = routineSummary(routine, byId);
            return (
              <Card key={routine.id} onPress={() => openRoutine(routine.id)} style={styles.routine}>
                <ThemedText type="subtitle" style={styles.routineName}>
                  {routine.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {summary.counts}
                </ThemedText>
                {summary.preview ? <ThemedText type="small">{summary.preview}</ThemedText> : null}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { gap: Spacing.three, padding: Spacing.four },
  routine: { gap: Spacing.one, paddingVertical: Spacing.four },
  routineName: { fontSize: 26, lineHeight: 32 },
});
