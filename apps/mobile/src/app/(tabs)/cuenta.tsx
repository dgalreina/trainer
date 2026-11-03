import { Button } from '@/components/form';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const { email, signOut } = useAuth();

  return (
    <Screen title="Cuenta">
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Sesión iniciada con
        </ThemedText>
        <ThemedText>{email}</ThemedText>
      </Card>
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
