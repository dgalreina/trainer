import { Platform } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { Waves } from '@/components/waves';

export default function TabsLayout() {
  // En iOS/Android las pestañas son nativas y sus pantallas opacas: cada pantalla
  // dibuja sus propias ondas.
  if (Platform.OS !== 'web') return <AppTabs />;

  // En la web las ondas viven aquí, detrás de todas las pestañas: no se mueven al cambiar
  // de pestaña, solo el contenido, mientras ellas siguen ondeando.
  return (
    <ThemedView style={{ flex: 1 }}>
      <Waves height={230} />
      <AppTabs />
    </ThemedView>
  );
}
