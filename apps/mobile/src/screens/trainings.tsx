import { routineTitle, trainingProgress } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/dates';
import { useSettings } from '@/lib/settings';
import { progressLabel } from '@/lib/training-progress';
import { useTrainings } from '@/lib/trainings';

export function TrainingsScreen() {
  const router = useRouter();
  const { trainings, loading, error } = useTrainings();
  const { settings } = useSettings();
  const today = todayISO();

  return (
    <Screen title="Entrenos" scroll>
      <Button title="Nuevo entrenamiento" onPress={() => router.push('/entrenamiento/nuevo')} />
      <ErrorText message={error} />

      {!loading && trainings.length === 0 && !error && (
        <ThemedText themeColor="textSecondary">
          Todavía no tienes ningún entrenamiento. Crea el primero con el botón de arriba y añádele
          las rutinas de cada día.
        </ThemedText>
      )}

      {trainings.map((training) => {
        const progress = trainingProgress(training, today);
        const isActive = settings.activeTrainingId === training.id;
        return (
          <Card
            key={training.id}
            tone={isActive ? 'primarySoft' : 'backgroundElement'}
            onPress={() =>
              router.push({ pathname: '/entrenamiento/[id]', params: { id: training.id } })
            }
            style={styles.card}>
            <View style={styles.header}>
              <ThemedText type="smallBold" style={styles.name}>
                {training.name}
              </ThemedText>
              {isActive && (
                <ThemedText type="small" themeColor="primaryText">
                  Actual
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {progressLabel(training, progress)} · {training.routines.length}{' '}
              {training.routines.length === 1 ? 'rutina' : 'rutinas'}
            </ThemedText>
            {training.routines.length > 0 && (
              <ThemedText type="small">{training.routines.map((r) => routineTitle(training.routines, r.id)).join(' · ')}</ThemedText>
            )}
          </Card>
        );
      })}

    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1 },
});
