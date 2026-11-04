import {
  EMPTY_PROFILE,
  type CreateWeightEntry,
  type Profile,
  type UpdateProfile,
  type UpdateWeightEntry,
  type WeightEntry,
} from '@trainer/shared';
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

interface MeValue {
  profile: Profile;
  loading: boolean;
  /** Guarda solo lo que se pasa; `null` borra un dato. Devuelve el perfil completo. */
  saveProfile: (changes: UpdateProfile) => Promise<Profile>;
  /** La pesada más reciente, o null si nunca se ha pesado. */
  latestWeight: WeightEntry | null;
  addWeight: (entry: CreateWeightEntry) => Promise<WeightEntry>;
  removeWeight: (id: string) => Promise<void>;
  /** Cambia la fecha/hora (o el peso) de una pesada ya guardada. */
  updateWeight: (id: string, changes: UpdateWeightEntry) => Promise<void>;
  /** Cambia cada vez que se añade o borra una pesada: el calendario lo usa para recargarse. */
  weightsVersion: number;
}

const MeContext = createContext<MeValue | null>(null);

/** Los datos personales del usuario y su última pesada, compartidos por todas las pantallas. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightsVersion, setWeightsVersion] = useState(0);

  const loadLatest = useCallback(
    async () => setLatestWeight(await api.get<WeightEntry | null>('/me/weights/latest')),
    [],
  );

  useEffect(() => {
    if (status !== 'signedIn') {
      setProfile(EMPTY_PROFILE);
      setLatestWeight(null);
      return;
    }
    setLoading(true);
    Promise.all([api.get<Profile>('/me/profile').then(setProfile), loadLatest()])
      .catch(() => {
        // Sin datos la app sigue funcionando: el perfil queda vacío.
      })
      .finally(() => setLoading(false));
  }, [status, loadLatest]);

  const saveProfile = useCallback(async (changes: UpdateProfile) => {
    const saved = await api.put<Profile>('/me/profile', changes);
    setProfile(saved);
    return saved;
  }, []);

  const addWeight = useCallback(
    async (entry: CreateWeightEntry) => {
      const saved = await api.post<WeightEntry>('/me/weights', entry);
      await loadLatest();
      setWeightsVersion((v) => v + 1);
      return saved;
    },
    [loadLatest],
  );

  const updateWeight = useCallback(
    async (id: string, changes: UpdateWeightEntry) => {
      await api.patch(`/me/weights/${id}`, changes);
      // Mover una pesada puede cambiar cuál es la última.
      await loadLatest();
      setWeightsVersion((v) => v + 1);
    },
    [loadLatest],
  );

  const removeWeight = useCallback(
    async (id: string) => {
      await api.delete(`/me/weights/${id}`);
      await loadLatest();
      setWeightsVersion((v) => v + 1);
    },
    [loadLatest],
  );

  const value = useMemo<MeValue>(
    () => ({ profile, loading, saveProfile, latestWeight, addWeight, removeWeight, updateWeight, weightsVersion }),
    [profile, loading, saveProfile, latestWeight, addWeight, removeWeight, updateWeight, weightsVersion],
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe debe usarse dentro de MeProvider');
  return ctx;
}
