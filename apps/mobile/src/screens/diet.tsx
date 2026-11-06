import { dietMacros } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDiets } from '@/lib/diets';
import { useFoods } from '@/lib/foods';
import { useSettings } from '@/lib/settings';

export function DietScreen() {
  const router = useRouter();
  const { diets, loading, error } = useDiets();
  const { settings, setActiveDiet } = useSettings();
  const theme = useTheme();
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
              {/* El punto marca la dieta que se sigue desde hoy (sin fin); pulsarlo otra vez la quita. */}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={`Usar ${diet.name} como dieta actual`}
                hitSlop={8}
                onPress={() => {
                  // Pulsar la dieta actual la quita: desde hoy no se sigue ninguna.
                  setActiveDiet(isActive ? null : diet.id).catch(() => {});
                }}
                style={styles.dotHit}>
                <View style={[styles.dot, { borderColor: theme.primaryText }, isActive && { backgroundColor: theme.primary }]} />
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {diet.meals.length}{' '}
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
  dotHit: { padding: Spacing.one },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
