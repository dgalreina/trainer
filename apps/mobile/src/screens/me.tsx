import { useState } from 'react';

import { AccountSection } from '@/components/account-section';
import { AdminSection } from '@/components/admin-section';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { SectionTabs } from '@/components/section-tabs';
import { WeightTrendSection } from '@/components/weight-trend';
import { useCoach } from '@/lib/coach';

type Section = 'datos' | 'peso' | 'cuenta' | 'admin';

/** «Yo»: los datos personales, cómo evoluciona el peso y la cuenta. */
export function MeScreen() {
  const [section, setSection] = useState<Section>('datos');
  // El botón «Admin» solo existe para los administradores (el servidor lo comprueba además en cada petición).
  const { usage } = useCoach();
  const isAdmin = usage?.isAdmin === true;

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
            ...(isAdmin ? [{ key: 'admin' as const, label: 'Admin' }] : []),
          ]}
          value={section}
          onChange={setSection}
        />
      }>
      {section === 'datos' ? (
        <ProfileForm />
      ) : section === 'peso' ? (
        <WeightTrendSection />
      ) : section === 'admin' && isAdmin ? (
        <AdminSection />
      ) : (
        <AccountSection />
      )}
    </Screen>
  );
}
