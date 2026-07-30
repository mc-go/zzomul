import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ensureProfilesSchema,
  listProfiles,
  upsertProfile,
  type Profile,
  type ProfileUpdate,
} from '../lib/profiles';
import {
  ensureStatusesSchema,
  listStatuses,
  upsertStatus,
  type DailyStatus,
} from '../lib/statuses';

type ProfilesValue = {
  profiles: Record<string, Profile>;
  loading: boolean;
  error: string | null;
  getProfile: (id: string) => Profile | null;
  getProfileByEmpNo: (empNo: string) => Profile | null;
  save: (id: string, update: ProfileUpdate) => Promise<void>;
  refresh: () => Promise<void>;
  // 일자별 상태 메시지
  getStatus: (empNo: string, date: string) => string;
  saveStatus: (empNo: string, date: string, message: string) => Promise<void>;
};

const ProfilesContext = createContext<ProfilesValue | null>(null);

function statusKey(empNo: string, date: string): string {
  return `${empNo}|${date}`;
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureProfilesSchema();
      await ensureStatusesSchema();
      const [rows, statusRows] = await Promise.all([listProfiles(), listStatuses()]);
      const pmap: Record<string, Profile> = {};
      for (const p of rows) pmap[p.id] = p;
      setProfiles(pmap);
      const smap: Record<string, string> = {};
      for (const s of statusRows as DailyStatus[]) {
        smap[statusKey(s.empNo, s.date)] = s.message;
      }
      setStatuses(smap);
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

  const saveStatus = useCallback(
    async (empNo: string, date: string, message: string) => {
      await upsertStatus(empNo, date, message);
      setStatuses((prev) => {
        const next = { ...prev };
        const trimmed = message.trim();
        if (trimmed) next[statusKey(empNo, date)] = trimmed;
        else delete next[statusKey(empNo, date)];
        return next;
      });
    },
    [],
  );

  const getProfile = useCallback(
    (id: string): Profile | null => profiles[id] ?? null,
    [profiles],
  );

  const byEmpNo = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of Object.values(profiles)) {
      if (p.empNo) map[p.empNo] = p;
    }
    return map;
  }, [profiles]);

  const getProfileByEmpNo = useCallback(
    (empNo: string): Profile | null => byEmpNo[empNo] ?? null,
    [byEmpNo],
  );

  const getStatus = useCallback(
    (empNo: string, date: string): string => statuses[statusKey(empNo, date)] ?? '',
    [statuses],
  );

  const value = useMemo<ProfilesValue>(
    () => ({
      profiles,
      loading,
      error,
      getProfile,
      getProfileByEmpNo,
      save,
      refresh,
      getStatus,
      saveStatus,
    }),
    [profiles, loading, error, getProfile, getProfileByEmpNo, save, refresh, getStatus, saveStatus],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within ProfilesProvider');
  return ctx;
}
