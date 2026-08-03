import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchEmployees, type EmployeeRecord } from '../lib/attendance';
import { MEMBER_EMPNOS, extraParticipantName } from '../lib/members';
import { useAuth } from './AuthContext';
import { useProfiles } from './ProfilesContext';

type AppDataValue = {
  names: Record<string, string>;
  resolveName: (id: string) => string;
  namesLoading: boolean;
  myEmpNo: string | null;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { profiles, save: saveProfile, refresh: refreshProfiles } = useProfiles();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);

  useEffect(() => {
    // 게스트는 듀얼아이 토큰이 없으므로 employees 조회 스킵
    if (!session?.token || session.role !== 'konai') {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    setNamesLoading(true);
    fetchEmployees(session.token)
      .then((all) => {
        if (!cancelled) setEmployees(all);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setNamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role]);

  // employees API 로드되면 3명 konai 멤버의 사번/이름을 users 테이블에도 동기화.
  // 이렇게 해두면 게스트가 나중에 로그인해도 users 테이블에서 이름을 읽어옴.
  useEffect(() => {
    if (employees.length === 0) return;
    const konaiMembers = employees.filter((e) =>
      (MEMBER_EMPNOS as readonly string[]).includes(e.empNo),
    );
    let changed = false;
    const doSync = async () => {
      for (const m of konaiMembers) {
        const id = String(m.empId);
        const existing = profiles[id];
        if (!existing || existing.name !== m.empNm || existing.empNo !== m.empNo) {
          try {
            await saveProfile(id, { empNo: m.empNo, name: m.empNm });
            changed = true;
          } catch {
            // 실패해도 앱 진행에는 지장 없음
          }
        }
      }
      if (changed) await refreshProfiles();
    };
    void doSync();
    // 의존성에서 profiles/saveProfile 자주 바뀌면 루프 위험 있어서
    // employees만 트리거로 씀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emp of employees) {
      if ((MEMBER_EMPNOS as readonly string[]).includes(emp.empNo)) {
        map[emp.empNo] = emp.empNm;
      }
    }
    return map;
  }, [employees]);

  // 게스트는 세션에 담긴 participant_id(=empNo)를 그대로 사용.
  // 코나이(듀얼아이)는 employees[].empId ↔ session.userId 매칭으로 자동 감지.
  const myEmpNo = useMemo(() => {
    if (session?.role === 'guest') return session?.empNo ?? null;
    const uid = session?.userId;
    if (!uid || employees.length === 0) return null;
    const match = employees.find((e) => String(e.empId) === String(uid));
    if (match) {
      console.log('[me detected]', match.empNo, match.empNm);
      return match.empNo;
    }
    console.log('[me detection] userId', uid, 'not found in employees list');
    return null;
  }, [session?.role, session?.userId, session?.empNo, employees]);

  // 이름 매핑 우선순위:
  // 1) EXTRA_PARTICIPANTS (박소현 등)
  // 2) 현재 세션의 employees API 응답
  // 3) users 테이블 (다른 사람이 저장해둔 프로필)
  // 4) 원본 ID (사번) 그대로
  const profilesByEmpNo = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of Object.values(profiles)) {
      if (p.empNo && p.name) map[p.empNo] = p.name;
    }
    return map;
  }, [profiles]);

  const resolveName = useCallback(
    (id: string): string => {
      const extra = extraParticipantName(id);
      if (extra) return extra;
      if (names[id]) return names[id];
      if (profilesByEmpNo[id]) return profilesByEmpNo[id];
      return id;
    },
    [names, profilesByEmpNo],
  );

  const value = useMemo<AppDataValue>(
    () => ({ names, resolveName, namesLoading, myEmpNo }),
    [names, resolveName, namesLoading, myEmpNo],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
