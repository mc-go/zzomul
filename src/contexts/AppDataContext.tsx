import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchTrackedNames } from '../lib/attendance';
import { extraParticipantName } from '../lib/members';
import { useAuth } from './AuthContext';

const ME_STORAGE_KEY = 'zzomul.me.empNo.v1';

type AppDataValue = {
  me: string | null;
  setMe: (empNo: string | null) => void;
  names: Record<string, string>;
  resolveName: (id: string) => string;
  namesLoading: boolean;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [me, setMeState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ME_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [names, setNames] = useState<Record<string, string>>({});
  const [namesLoading, setNamesLoading] = useState(false);

  useEffect(() => {
    if (!session?.token) {
      setNames({});
      return;
    }
    let cancelled = false;
    setNamesLoading(true);
    fetchTrackedNames(session.token)
      .then((n) => {
        if (!cancelled) setNames(n);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setNamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const setMe = useCallback((empNo: string | null) => {
    try {
      if (empNo) localStorage.setItem(ME_STORAGE_KEY, empNo);
      else localStorage.removeItem(ME_STORAGE_KEY);
    } catch {
      // ignore
    }
    setMeState(empNo);
  }, []);

  const resolveName = useCallback(
    (id: string): string => extraParticipantName(id) ?? names[id] ?? id,
    [names],
  );

  const value = useMemo<AppDataValue>(
    () => ({ me, setMe, names, resolveName, namesLoading }),
    [me, setMe, names, resolveName, namesLoading],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
