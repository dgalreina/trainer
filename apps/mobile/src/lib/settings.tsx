import { dietIdOn, type Diet, type Training, type UserSettings } from '@trainer/shared';
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
import { todayISO } from '@/lib/dates';
import { useDiets } from '@/lib/diets';
import { useTrainings } from '@/lib/trainings';

const EMPTY: UserSettings = { activeTrainingId: null, activeDietId: null, dietSchedule: [], routinesResetAt: null };

interface SettingsValue {
  settings: UserSettings;
  /** El entrenamiento que el usuario tiene en marcha ahora, si lo hay. */
  activeTraining: Training | null;
  setActiveTraining: (id: string | null) => Promise<void>;
  /** «Desmarcar todos»: desde ahora no cuentan los entrenos anteriores para marcar rutinas como hechas. */
  resetRoutines: () => Promise<void>;
  /** La dieta que el usuario sigue ahora, si la hay. */
  activeDiet: Diet | null;
  /** Desde hoy se sigue esa dieta (sin fin, hasta que se cambia o se quita con `null`). */
  setActiveDiet: (id: string | null) => Promise<void>;
  /** La dieta que rige un día (AAAA-MM-DD), si la hay: antes de activarla no, después sí, sin fin. */
  dietOn: (day: string) => Diet | null;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Una API anterior al calendario de dietas no manda `dietSchedule`: se toma como vacío. */
const normalize = (s: UserSettings): UserSettings => ({
  ...s,
  dietSchedule: s.dietSchedule ?? [],
  routinesResetAt: s.routinesResetAt ?? null,
});

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
    api.get<UserSettings>('/me/settings').then((s) => setSettings(normalize(s))).catch(() => {
      // Sin ajustes no hay entrenamiento activo: la app sigue funcionando.
    });
  }, [status]);

  const setActiveTraining = useCallback(async (id: string | null) => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { activeTrainingId: id })));
  }, []);

  const resetRoutines = useCallback(async () => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { routinesResetAt: new Date().toISOString() })));
  }, []);

  const setActiveDiet = useCallback(async (id: string | null) => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { activeDietId: id, dietSince: todayISO() })));
  }, []);

  const activeTraining = useMemo(
    () => trainings.find((t) => t.id === settings.activeTrainingId) ?? null,
    [trainings, settings.activeTrainingId],
  );

  const activeDiet = useMemo(
    () => diets.find((d) => d.id === settings.activeDietId) ?? null,
    [diets, settings.activeDietId],
  );

  const dietOn = useCallback(
    (day: string) => {
      // Sin calendario (ajustes de antes), la dieta actual rige desde su fecha de inicio.
      const legacy = diets.find((d) => d.id === settings.activeDietId);
      const schedule =
        settings.dietSchedule.length === 0 && legacy
          ? [{ from: legacy.startDate, dietId: legacy.id }]
          : settings.dietSchedule;
      const id = dietIdOn(schedule, day);
      return id ? (diets.find((d) => d.id === id) ?? null) : null;
    },
    [settings.dietSchedule, settings.activeDietId, diets],
  );

  const value = useMemo<SettingsValue>(
    () => ({ settings, activeTraining, setActiveTraining, resetRoutines, activeDiet, setActiveDiet, dietOn }),
    [settings, activeTraining, setActiveTraining, resetRoutines, activeDiet, setActiveDiet, dietOn],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}
