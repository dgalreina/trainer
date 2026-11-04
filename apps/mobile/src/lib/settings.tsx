import type { Diet, Training, UserSettings } from '@trainer/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDiets } from '@/lib/diets';
import { useTrainings } from '@/lib/trainings';

const EMPTY: UserSettings = { activeTrainingId: null, activeDietId: null };

interface SettingsValue {
  settings: UserSettings;
  /** El entrenamiento que el usuario tiene en marcha ahora, si lo hay. */
  activeTraining: Training | null;
  setActiveTraining: (id: string | null) => Promise<void>;
  /** La dieta que el usuario sigue ahora, si la hay. */
  activeDiet: Diet | null;
  setActiveDiet: (id: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Qué entrenamiento y qué dieta tiene el usuario en marcha ahora. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { trainings } = useTrainings();
  const { diets } = useDiets();
  const [settings, setSettings] = useState<UserSettings>(EMPTY);

  useEffect(() => {
    if (status !== 'signedIn') {
      setSettings(EMPTY);
      return;
    }
    api.get<UserSettings>('/me/settings').then(setSettings).catch(() => {
      // Sin ajustes no hay entrenamiento activo: la app sigue funcionando.
    });
  }, [status]);

  const setActiveTraining = useCallback(async (id: string | null) => {
    setSettings(await api.put<UserSettings>('/me/settings', { activeTrainingId: id }));
  }, []);

  const setActiveDiet = useCallback(async (id: string | null) => {
    setSettings(await api.put<UserSettings>('/me/settings', { activeDietId: id }));
  }, []);

  const activeTraining = useMemo(
    () => trainings.find((t) => t.id === settings.activeTrainingId) ?? null,
    [trainings, settings.activeTrainingId],
  );

  const activeDiet = useMemo(
    () => diets.find((d) => d.id === settings.activeDietId) ?? null,
    [diets, settings.activeDietId],
  );

  const value = useMemo<SettingsValue>(
    () => ({ settings, activeTraining, setActiveTraining, activeDiet, setActiveDiet }),
    [settings, activeTraining, setActiveTraining, activeDiet, setActiveDiet],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}
