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

const EMPTY: UserSettings = { activeTrainingId: null, activeDietId: null, dietSchedule: [], routinesResetAt: null, extraBurnKcal: null, extraBurnAuto: true };

interface SettingsValue {
  settings: UserSettings;
  /** El entrenamiento que el usuario tiene en marcha ahora, si lo hay. */
  activeTraining: Training | null;
  setActiveTraining: (id: string | null) => Promise<void>;
  /** «Desmarcar todos»: desde ahora no cuentan los entrenos anteriores para marcar rutinas como hechas. */
  resetRoutines: () => Promise<void>;
  /** Gasto diario extra (kcal) por moverte y digerir que se suma al basal en las gráficas; null lo quita. */
  setExtraBurn: (kcal: number | null) => Promise<void>;
  /** Que el gasto extra se recalcule solo (o solo a mano). */
  setExtraBurnAuto: (auto: boolean) => Promise<void>;
  /** Quita el gasto extra y apaga el automático, en una sola petición (si no, el automático lo volvería a poner). */
  clearExtraBurn: () => Promise<void>;
  /** Ya han llegado los ajustes del servidor (hasta entonces `settings` son los de por defecto). */
  loaded: boolean;
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
  extraBurnKcal: s.extraBurnKcal ?? null,
  extraBurnAuto: s.extraBurnAuto ?? true,
});

/** Qué entrenamiento y qué dieta tiene el usuario en marcha ahora. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { trainings } = useTrainings();
  const { diets } = useDiets();
  const [settings, setSettings] = useState<UserSettings>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== 'signedIn') {
      setSettings(EMPTY);
      setLoaded(false);
      return;
    }
    api
      .get<UserSettings>('/me/settings')
      .then((s) => {
        setSettings(normalize(s));
        setLoaded(true);
      })
      .catch(() => {
        // Sin ajustes no hay entrenamiento activo: la app sigue funcionando.
      });
  }, [status]);

  const setActiveTraining = useCallback(async (id: string | null) => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { activeTrainingId: id })));
  }, []);

  const resetRoutines = useCallback(async () => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { routinesResetAt: new Date().toISOString() })));
  }, []);

  const setExtraBurn = useCallback(async (kcal: number | null) => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { extraBurnKcal: kcal })));
  }, []);

  const setExtraBurnAuto = useCallback(async (auto: boolean) => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { extraBurnAuto: auto })));
  }, []);

  const clearExtraBurn = useCallback(async () => {
    setSettings(normalize(await api.put<UserSettings>('/me/settings', { extraBurnKcal: null, extraBurnAuto: false })));
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
    () => ({ settings, activeTraining, setActiveTraining, resetRoutines, setExtraBurn, setExtraBurnAuto, clearExtraBurn, loaded, activeDiet, setActiveDiet, dietOn }),
    [settings, activeTraining, setActiveTraining, resetRoutines, setExtraBurn, setExtraBurnAuto, clearExtraBurn, loaded, activeDiet, setActiveDiet, dietOn],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}
