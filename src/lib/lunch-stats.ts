import { format } from 'date-fns';
import type { Lunch } from './lunches';
import { RECURRING_LUNCH_PLANS, type LunchPlan } from './lunch-plans';
import { holidayName } from './holidays';
import { isAwayAtLunch } from './attendance-status';
import type { MemberDaily } from './attendance';
import { MEMBER_EMPNOS, type MemberEmpNo } from './members';

// 캘린더/통계 공용 헬퍼 — 원래 CalendarPage 안에 있던 계산을
// 먹기록 탭의 연간 어워드에서도 쓰기 위해 분리했다.

// 가게명 비교용 정규화 — 공백/대소문자 차이는 같은 가게로 본다 (단골 뱃지·어워드·월간 결산 공용)
export function normalizeRestaurant(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

// 각 먹기록이 캘린더에 얹힐 날짜로 그룹핑 (wishlist는 plannedDate, done은 date)
export function buildLunchesByDate(lunches: Lunch[]): Record<string, Lunch[]> {
  const map: Record<string, Lunch[]> = {};
  for (const l of lunches) {
    const key = l.status === 'wishlist' ? l.plannedDate : l.date;
    if (!key) continue;
    (map[key] ??= []).push(l);
  }
  return map;
}

// 날짜별 점심 약속: DB에 등록된 약속 + 매주 반복되는 고정 약속(합성).
// 고정 약속은 공휴일이거나 휴가 등으로 점심시간에 근무가 아니면 빼고,
// 같은 날 본인이 직접 등록한 약속이 있으면 그쪽을 우선한다.
// skipped 행은 "그날만 고정 약속 쉬어감" 표시 — 약속으로 렌더링하지 않고 합성만 막는다.
export function buildPlansByDate(
  lunchPlans: LunchPlan[],
  days: Date[],
  byMember: MemberDaily,
): Record<string, LunchPlan[]> {
  const map: Record<string, LunchPlan[]> = {};
  const skipKeys = new Set<string>();
  for (const p of lunchPlans) {
    if (p.skipped) {
      skipKeys.add(`${p.empNo}|${p.date}`);
      continue;
    }
    (map[p.date] ??= []).push(p);
  }
  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd');
    if (holidayName(key)) continue;
    for (const r of RECURRING_LUNCH_PLANS) {
      if (day.getDay() !== r.weekday) continue;
      if (skipKeys.has(`${r.empNo}|${key}`)) continue;
      if (isAwayAtLunch(byMember[r.empNo as MemberEmpNo]?.[key])) continue;
      if ((map[key] ?? []).some((p) => p.empNo === r.empNo)) continue;
      (map[key] ??= []).push({ empNo: r.empNo, date: key, note: r.note, updatedAt: '', fixed: true });
    }
  }
  return map;
}

export type DosirakStats = {
  counted: number; // 도시락 판정 대상이 된 지나간 평일 수
  per: Record<string, { dosirak: number; zzomul: number; plan: number }>;
  hasAny: boolean;
};

// 도시락 리포트: 사람별 집계.
// 판정 우선순위 — 약속 > 쪼물런치 참여 > 도시락.
// 이미 잡힌 쪼물런치/약속은 미래여도 포함, 도시락만 "오늘까지 지난 평일" 기준
// (미래의 도시락은 아직 알 수 없으니까).
// 점심시간에 회사에 없는 날(연차·안식휴가·오전 반차)은 도시락으로 안 침 — isAwayAtLunch 참고.
export function computeDosirakStats(
  days: Date[],
  lunchesByDate: Record<string, Lunch[]>,
  plansByDate: Record<string, LunchPlan[]>,
  byMember: MemberDaily,
  todayKey: string,
): DosirakStats {
  let counted = 0;
  const per: Record<string, { dosirak: number; zzomul: number; plan: number }> = {};
  for (const emp of MEMBER_EMPNOS) per[emp] = { dosirak: 0, zzomul: 0, plan: 0 };
  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd');
    if (holidayName(key)) continue;
    const isPast = key <= todayKey;
    if (isPast) counted += 1;
    const dayLunches = lunchesByDate[key] ?? [];
    const dayPlans = plansByDate[key] ?? [];
    for (const emp of MEMBER_EMPNOS) {
      const hasPlan = dayPlans.some((p) => p.empNo === emp);
      const inZzomulLunch = dayLunches.some(
        (l) =>
          l.meal === 'lunch' &&
          (l.participants.length === 0 || (l.participants as readonly string[]).includes(emp)),
      );
      if (hasPlan) per[emp].plan += 1;
      else if (inZzomulLunch) per[emp].zzomul += 1;
      else if (isPast && !isAwayAtLunch(byMember[emp]?.[key])) per[emp].dosirak += 1;
    }
  }
  const hasAny = counted > 0 || Object.values(per).some((s) => s.plan + s.zzomul > 0);
  return { counted, per, hasAny };
}
