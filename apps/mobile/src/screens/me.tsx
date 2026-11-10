import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountSection } from '@/components/account-section';
import { Chip } from '@/components/form';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';

type Section = 'datos' | 'cuenta';

/** «Yo»: los datos personales y la cuenta. */
export function MeScreen() {
  const [section, setSection] = useState<Section>('datos');

  return (
    // Los dos botones quedan fijos arriba; solo se desplaza lo de debajo, con difuminado en los bordes.
    <Screen
      fade
      fixedTop={
        <View style={styles.sections}>
          <Chip label="Mis datos" active={section === 'datos'} onPress={() => setSection('datos')} />
          <Chip label="Mi cuenta" active={section === 'cuenta'} onPress={() => setSection('cuenta')} />
        </View>
      }>
      {section === 'datos' ? <ProfileForm /> : <AccountSection />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
