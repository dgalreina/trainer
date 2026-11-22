import { useState } from 'react';

import { AccountSection } from '@/components/account-section';
import { AdminSection } from '@/components/admin-section';
import { ExerciseProgressSection } from '@/components/exercise-progress';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { SectionTabs } from '@/components/section-tabs';
import { WeightTrendSection } from '@/components/weight-trend';
import { useCoach } from '@/lib/coach';

type Section = 'datos' | 'peso' | 'progreso' | 'cuenta' | 'admin';

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
            { key: 'progreso', label: 'Progreso' },
            { key: 'cuenta', label: 'Mi cuenta' },
          ]}
          extra={isAdmin ? [{ key: 'admin', label: 'Admin' }] : []}
          value={section}
          onChange={setSection}
        />
      }>
      {section === 'datos' ? (
        <ProfileForm />
      ) : section === 'peso' ? (
        <WeightTrendSection />
      ) : section === 'progreso' ? (
        <ExerciseProgressSection />
      ) : section === 'admin' && isAdmin ? (
        <AdminSection />
      ) : (
        <AccountSection />
      )}
    </Screen>
  );
}
