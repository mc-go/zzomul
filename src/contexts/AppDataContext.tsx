import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchEmployees, type EmployeeRecord } from '../lib/attendance';
import { MEMBER_EMPNOS, extraParticipantName } from '../lib/members';
import { useAuth } from './AuthContext';

type AppDataValue = {
  names: Record<string, string>;
  resolveName: (id: string) => string;
  namesLoading: boolean;
  myEmpNo: string | null;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);

  useEffect(() => {
    if (!session?.token) {
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
  }, [session?.token]);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emp of employees) {
      if ((MEMBER_EMPNOS as readonly string[]).includes(emp.empNo)) {
        map[emp.empNo] = emp.empNm;
      }
    }
    return map;
  }, [employees]);

  // 로그인 응답의 userId를 employees[].empId와 대조해서 내 사번 자동 감지.
  // 매칭 실패 시 null → 사용자가 프로필 편집에서 수동 입력해야 함.
  const myEmpNo = useMemo(() => {
    const uid = session?.userId;
    if (!uid || employees.length === 0) return null;
    const match = employees.find((e) => String(e.empId) === String(uid));
    if (match) {
      console.log('[me detected]', match.empNo, match.empNm);
      return match.empNo;
    }
    console.log('[me detection] userId', uid, 'not found in employees list');
    return null;
  }, [session?.userId, employees]);

  const resolveName = useCallback(
    (id: string): string => extraParticipantName(id) ?? names[id] ?? id,
    [names],
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
