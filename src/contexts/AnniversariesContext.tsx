import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ensureAnniversariesSchema,
  listAnniversaries,
  type Anniversary,
} from '../lib/anniversaries';

// 기념일 목록을 앱 전체에서 공유 (캘린더 배지 / 설정 메뉴 관리 / 알림 팝업)
type AnniversariesValue = {
  items: Anniversary[];
  ready: boolean;
  refresh: () => Promise<void>;
};

const AnniversariesContext = createContext<AnniversariesValue | null>(null);

export function AnniversariesProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Anniversary[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await ensureAnniversariesSchema();
      setItems(await listAnniversaries());
    } catch {
      // 기념일 로드 실패는 앱 사용을 막지 않음
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AnniversariesValue>(
    () => ({ items, ready, refresh }),
    [items, ready, refresh],
  );

  return <AnniversariesContext.Provider value={value}>{children}</AnniversariesContext.Provider>;
}

export function useAnniversaries(): AnniversariesValue {
  const ctx = useContext(AnniversariesContext);
  if (!ctx) throw new Error('useAnniversaries must be used within AnniversariesProvider');
  return ctx;
}
