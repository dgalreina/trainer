import type { Training, UserSettings } from '@trainer/shared';
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
import { useTrainings } from '@/lib/trainings';

const EMPTY: UserSettings = { activeTrainingId: null, activeDietId: null };

interface SettingsValue {
  settings: UserSettings;
  /** El entrenamiento que el usuario tiene en marcha ahora, si lo hay. */
  activeTraining: Training | null;
  setActiveTraining: (id: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Qué entrenamiento (y, más adelante, qué dieta) tiene el usuario en marcha ahora. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { trainings } = useTrainings();
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

  const activeTraining = useMemo(
    () => trainings.find((t) => t.id === settings.activeTrainingId) ?? null,
    [trainings, settings.activeTrainingId],
  );

  const value = useMemo<SettingsValue>(
    () => ({ settings, activeTraining, setActiveTraining }),
    [settings, activeTraining, setActiveTraining],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}
