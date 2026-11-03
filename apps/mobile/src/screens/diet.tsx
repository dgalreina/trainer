import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export function DietScreen() {
  return (
    <Screen title="Dieta" subtitle="Lo que comes">
      <Card tone="primarySoft">
        <ThemedText type="smallBold">Próximamente</ThemedText>
        <ThemedText themeColor="textSecondary">
          Aquí podrás crear tu dieta, con su objetivo, tus calorías y macros diarios, y las comidas
          del día con sus alimentos.
        </ThemedText>
      </Card>
    </Screen>
  );
}
