import { dietMacros } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDiets } from '@/lib/diets';
import { useFoods } from '@/lib/foods';
import { GOAL_LABELS } from '@/lib/profile-labels';
import { useSettings } from '@/lib/settings';

export function DietScreen() {
  const router = useRouter();
  const { diets, loading, error } = useDiets();
  const { settings } = useSettings();
  const { foods } = useFoods();
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  return (
    <Screen title="Dieta" scroll>
      <Button title="Nueva dieta" onPress={() => router.push('/mi-dieta/nueva')} />
      <ErrorText message={error} />

      {!loading && diets.length === 0 && !error && (
        <ThemedText themeColor="textSecondary">
          Todavía no tienes ninguna dieta. Crea la primera y añádele las comidas del día con sus
          alimentos; el código te calcula las calorías y los macros.
        </ThemedText>
      )}

      {diets.map((diet) => {
        const isActive = settings.activeDietId === diet.id;
        const total = dietMacros(diet, byId);
        return (
          <Card
            key={diet.id}
            tone={isActive ? 'primarySoft' : 'backgroundElement'}
            onPress={() => router.push({ pathname: '/mi-dieta/[id]', params: { id: diet.id } })}
            style={styles.card}>
            <View style={styles.header}>
              <ThemedText type="smallBold" style={styles.name}>
                {diet.name}
              </ThemedText>
              {isActive && (
                <ThemedText type="small" themeColor="primaryText">
                  Actual
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {GOAL_LABELS[diet.goal]} · {diet.meals.length}{' '}
              {diet.meals.length === 1 ? 'comida' : 'comidas'}
              {total.kcal > 0 ? ` · ${total.kcal} kcal` : ''}
            </ThemedText>
            {diet.meals.length > 0 && (
              <ThemedText type="small">
                {diet.meals.map((m) => `${m.time} ${m.name}`).join(' · ')}
              </ThemedText>
            )}
          </Card>
        );
      })}

      <Button
        title="Catálogo de alimentos"
        variant="secondary"
        onPress={() => router.push('/alimentos')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1 },
});
