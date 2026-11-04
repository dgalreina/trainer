import { useRouter } from 'expo-router';

import { Card } from '@/components/card';
import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export function DietScreen() {
  const router = useRouter();
  return (
    <Screen title="Dieta">
      <Card tone="primarySoft">
        <ThemedText type="smallBold">Próximamente</ThemedText>
        <ThemedText themeColor="textSecondary">
          Aquí podrás crear tu dieta, con su objetivo, tus calorías y macros diarios, y las comidas
          del día con sus alimentos.
        </ThemedText>
      </Card>
      <Button
        title="Catálogo de alimentos"
        variant="secondary"
        onPress={() => router.push('/alimentos')}
      />
    </Screen>
  );
}
