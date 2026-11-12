import { useState } from 'react';

import { AccountSection } from '@/components/account-section';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { SectionTabs } from '@/components/section-tabs';
import { WeightTrendSection } from '@/components/weight-trend';

type Section = 'datos' | 'peso' | 'cuenta';

/** «Yo»: los datos personales, cómo evoluciona el peso y la cuenta. */
export function MeScreen() {
  const [section, setSection] = useState<Section>('datos');

  return (
    // Los dos botones quedan fijos arriba; solo se desplaza lo de debajo, con difuminado en los bordes.
    <Screen
      fade
      fixedTop={
        <SectionTabs
          options={[
            { key: 'datos', label: 'Mis datos' },
            { key: 'peso', label: 'Mi peso' },
            { key: 'cuenta', label: 'Mi cuenta' },
          ]}
          value={section}
          onChange={setSection}
        />
      }>
      {section === 'datos' ? <ProfileForm /> : section === 'peso' ? <WeightTrendSection /> : <AccountSection />}
    </Screen>
  );
}
