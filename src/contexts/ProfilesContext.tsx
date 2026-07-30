import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ensureProfilesSchema,
  listProfiles,
  upsertProfile,
  type Profile,
  type ProfileUpdate,
} from '../lib/profiles';

type ProfilesValue = {
  profiles: Record<string, Profile>;
  loading: boolean;
  error: string | null;
  getProfile: (id: string) => Profile | null;
  save: (id: string, update: ProfileUpdate) => Promise<void>;
  refresh: () => Promise<void>;
};

const ProfilesContext = createContext<ProfilesValue | null>(null);

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureProfilesSchema();
      const rows = await listProfiles();
      const map: Record<string, Profile> = {};
      for (const p of rows) map[p.id] = p;
      setProfiles(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : '프로필 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (id: string, update: ProfileUpdate) => {
      await upsertProfile(id, update);
      await refresh();
    },
    [refresh],
  );

  const getProfile = useCallback(
    (id: string): Profile | null => profiles[id] ?? null,
    [profiles],
  );

  const value = useMemo<ProfilesValue>(
    () => ({ profiles, loading, error, getProfile, save, refresh }),
    [profiles, loading, error, getProfile, save, refresh],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within ProfilesProvider');
  return ctx;
}
