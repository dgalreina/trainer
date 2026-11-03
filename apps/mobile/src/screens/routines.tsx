import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useExercises } from '@/lib/exercises';
import { routineSummary } from '@/lib/routine-summary';
import { useRoutines } from '@/lib/routines';

export function RoutinesScreen() {
  const router = useRouter();
  const { routines, loading, error } = useRoutines();
  const { byId } = useExercises();

  return (
    <Screen title="Rutinas" subtitle="Tus entrenamientos">
      <Button title="Nueva rutina" onPress={() => router.push('/rutina/nueva')} />
      <ErrorText message={error} />

      {!loading && routines.length === 0 && !error && (
        <ThemedText themeColor="textSecondary">
          Todavía no tienes ninguna rutina. Crea la primera con el botón de arriba.
        </ThemedText>
      )}

      {routines.map((routine) => {
        const summary = routineSummary(routine, byId);
        return (
          <Card
            key={routine.id}
            onPress={() => router.push({ pathname: '/rutina/[id]', params: { id: routine.id } })}
            style={styles.card}>
            <ThemedText type="smallBold">{routine.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {summary.counts}
            </ThemedText>
            {summary.preview ? <ThemedText type="small">{summary.preview}</ThemedText> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
});
