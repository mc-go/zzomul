import { useEffect, useState } from 'react';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { fetchAttendances, indexByMemberAndDate } from '../lib/attendance';
import {
  buildLunchesByDate,
  buildPlansByDate,
  computeDosirakStats,
  statsStartOfYear,
} from '../lib/lunch-stats';
import type { Lunch } from '../lib/lunches';
import type { LunchPlan } from '../lib/lunch-plans';
import { ensureSettingsSchema, getSetting, savingsGoalKey, dosirakKcalKey } from '../lib/settings';
import { DB_WRITE_EVENT } from '../lib/db';
import { MEMBER_EMPNOS } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';

// 절약 챌린지 — 도시락 리포트의 각 멤버 줄에 연간 목표 게이지로 표시.
// 집계 시작일은 연간 통계 공통 하한(lunch-stats.ts의 STATS_START = 2026-08-01)을 따른다.
// 목표액은 연 단위·사람별 — 헤더 ⚙️ 설정 → "웰빙 저금통"에서 본인 것만 지정.

const PRICE_PER_DAY = 8_000;

export type SavingsChallengeData = {
  year: string;
  days: Record<string, number> | null; // empNo → 도시락 일수 (게스트/로딩 전엔 null)
  goals: Record<string, number>; // empNo → 목표액 (설정한 사람만)
  kcals: Record<string, number>; // empNo → 도시락 한 끼 kcal (설정한 사람만, 연도 무관)
};

// 연간 도시락 일수 + 사람별 목표 로드 (근태는 1회, 목표는 DB 쓰기 때마다 갱신)
export function useSavingsChallenge(
  lunches: Lunch[],
  plans: LunchPlan[],
  todayKey: string,
): SavingsChallengeData {
  const { session } = useAuth();
  const year = todayKey.slice(0, 4);
  const start = statsStartOfYear(year); // 2026년엔 8/1, 2027년부터는 1/1
  const [days, setDays] = useState<Record<string, number> | null>(null);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [kcals, setKcals] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadGoals() {
      try {
        await ensureSettingsSchema();
        const entries = await Promise.all(
          MEMBER_EMPNOS.map(
            async (emp) =>
              [
                emp,
                await getSetting(savingsGoalKey(emp, year)),
                await getSetting(dosirakKcalKey(emp)),
              ] as const,
          ),
        );
        if (cancelled) return;
        const nextGoals: Record<string, number> = {};
        const nextKcals: Record<string, number> = {};
        for (const [emp, goal, kcal] of entries) {
          const g = Number(goal);
          if (g > 0) nextGoals[emp] = g;
          const k = Number(kcal);
          if (k > 0) nextKcals[emp] = k;
        }
        setGoals(nextGoals);
        setKcals(nextKcals);
      } catch {
        /* 목표 로드 실패 시 게이지만 생략 */
      }
    }
    void loadGoals();
    const onWrite = () => void loadGoals();
    window.addEventListener(DB_WRITE_EVENT, onWrite);
    return () => {
      cancelled = true;
      window.removeEventListener(DB_WRITE_EVENT, onWrite);
    };
  }, [year]);

  useEffect(() => {
    if (!session?.token || session.role !== 'konai') return;
    if (todayKey < start) return;
    let cancelled = false;
    (async () => {
      try {
        const records = await fetchAttendances(session.token, start, todayKey);
        if (cancelled) return;
        const byMember = indexByMemberAndDate(records);
        const weekdays = eachDayOfInterval({
          start: new Date(`${start}T00:00:00`),
          end: new Date(`${todayKey}T00:00:00`),
        }).filter((d) => !isWeekend(d));
        const stats = computeDosirakStats(
          weekdays,
          buildLunchesByDate(lunches),
          buildPlansByDate(plans, weekdays, byMember),
          byMember,
          todayKey,
        );
        if (cancelled) return;
        setDays(Object.fromEntries(MEMBER_EMPNOS.map((emp) => [emp, stats.per[emp].dosirak])));
      } catch {
        /* 근태 조회 실패 시 게이지만 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role, start, todayKey, lunches, plans]);

  return { year, days, goals, kcals };
}

// 멤버 줄 오른쪽의 미니 게이지 — 연간 절약액 vs 내 목표 (목표 미설정이면 설정 안내)
export function SavingsGauge({
  challenge,
  empNo,
}: {
  challenge: SavingsChallengeData;
  empNo: string;
}) {
  const goal = challenge.goals[empNo];
  if (challenge.days === null) return null; // 게스트/근태 로딩 전엔 게이지 줄 자체를 생략
  if (!goal) {
    // 목표를 안 정한 사람 자리엔 빈칸 대신 설정 안내
    return (
      <span
        className="text-[10px] text-ink-300 whitespace-nowrap"
        title="헤더 ⚙️ 설정 → 웰빙 저금통 설정에서 본인 목표를 정할 수 있어요"
      >
        🎯 목표를 설정해주세요!
      </span>
    );
  }
  const total = (challenge.days[empNo] ?? 0) * PRICE_PER_DAY;
  const pct = Math.round((total / goal) * 100);
  const achieved = total >= goal;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${challenge.year}년 절약 챌린지: ${total.toLocaleString()}원 / 목표 ${goal.toLocaleString()}원`}
    >
      <span className="inline-block w-16 h-1.5 rounded-full bg-white border border-lime-300 overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all duration-700 ${
            achieved ? 'bg-lime-500' : 'bg-lime-400'
          }`}
          style={{ width: `${Math.min(Math.max(pct, 3), 100)}%` }}
        />
      </span>
      <span className={`text-[10px] font-semibold ${achieved ? 'text-lime-700' : 'text-ink-400'}`}>
        {pct}%{achieved ? ' 🎉' : ''}
      </span>
    </span>
  );
}
