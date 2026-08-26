import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, eachDayOfInterval, format, isWeekend, startOfWeek } from 'date-fns';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';
import type { Lunch } from '../lib/lunches';
import { averageRating, type LunchReview } from '../lib/reviews';
import { fetchAttendances, indexByMemberAndDate } from '../lib/attendance';
import { ensureLunchPlansSchema, listLunchPlans } from '../lib/lunch-plans';
import {
  buildLunchesByDate,
  buildPlansByDate,
  computeDosirakStats,
  normalizeRestaurant,
} from '../lib/lunch-stats';
import { MEMBER_EMPNOS, isTrackedMember } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';

// 올해의 먹기록 어워드 — 먹기록 탭 맨 위 요약 카드.
// 전부 렌더링 시 계산만 하고 DB 저장은 없음.
// 도시락왕만 근태 데이터가 필요해서 올해치 근태를 따로 한 번 조회한다 (게스트는 생략).

const COLLAPSE_KEY = 'zzomul.awards.collapsed.v1';

// 기존 사용처(LunchPage 단골 뱃지) 호환용 재수출 — 본체는 lunch-stats.ts
export { normalizeRestaurant } from '../lib/lunch-stats';

type Award = {
  key: string;
  title: string;
  emoji: string;
  winner: string;
  detail?: string;
  lines?: string[]; // 도시락왕처럼 전원 순위를 여러 줄로 보여줄 때
};

export default function LunchAwards({
  lunches,
  reviews,
  memberName,
}: {
  lunches: Lunch[];
  reviews: Record<number, LunchReview[]>;
  memberName: (id: string) => string;
}) {
  const { session } = useAuth();
  const [todayKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const year = todayKey.slice(0, 4);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  // 도시락왕: 전원 순위(일수 내림차순) — 근태 조회가 끝나야 알 수 있어서 따로 state
  const [dosirakRank, setDosirakRank] = useState<{ name: string; days: number }[] | null>(null);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }

  const doneThisYear = useMemo(
    () => lunches.filter((l) => l.status === 'done' && l.date.startsWith(year)),
    [lunches, year],
  );

  // 도시락왕: 올해 1/1 ~ 오늘의 평일을 도시락 리포트와 같은 규칙으로 집계
  useEffect(() => {
    if (!session?.token || session.role !== 'konai') return;
    let cancelled = false;
    (async () => {
      try {
        const start = `${year}-01-01`;
        const [records, plans] = await Promise.all([
          fetchAttendances(session.token, start, todayKey),
          ensureLunchPlansSchema().then(() => listLunchPlans()),
        ]);
        if (cancelled) return;
        const byMember = indexByMemberAndDate(records);
        const days = eachDayOfInterval({
          start: new Date(`${start}T00:00:00`),
          end: new Date(`${todayKey}T00:00:00`),
        }).filter((d) => !isWeekend(d));
        const stats = computeDosirakStats(
          days,
          buildLunchesByDate(lunches),
          buildPlansByDate(plans, days, byMember),
          byMember,
          todayKey,
        );
        // 0일이어도 전원 순위에 포함 (일수 내림차순)
        const rank = MEMBER_EMPNOS.map((emp) => ({
          name: memberName(emp),
          days: stats.per[emp].dosirak,
        })).sort((a, b) => b.days - a.days);
        if (rank[0].days <= 0) return;
        setDosirakRank(rank);
      } catch {
        /* 근태 조회 실패 시 도시락왕만 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // lunches가 바뀔 때(기록 추가/삭제)도 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, session?.role, lunches, todayKey]);

  const awards = useMemo(() => {
    const list: Award[] = [];

    // 가게별로 묶기 (표시용 이름은 첫 기록의 원문 사용)
    const byPlace: Record<string, { name: string; records: Lunch[] }> = {};
    for (const l of doneThisYear) {
      const key = normalizeRestaurant(l.restaurant);
      if (!key) continue;
      (byPlace[key] ??= { name: l.restaurant, records: [] }).records.push(l);
    }

    // 🏅 최고 맛집: 멤버 참여자 전원이 별점 리뷰를 남긴 기록만 집계 —
    // 한 명만 후하게 준 곳이 1위가 되는 걸 막는다. 동점이면 전부 공동 1위로 병기.
    // (참여자 비었으면 전원 참여로 보고 멤버 전원의 리뷰를 요구, 퇴사자 등 EXTRA는 제외)
    let bestAvg = -1;
    const bestPlaces: { name: string; count: number }[] = [];
    for (const place of Object.values(byPlace)) {
      const ratings: number[] = [];
      for (const l of place.records) {
        const rs = reviews[l.id] ?? [];
        const memberParticipants = l.participants.filter(isTrackedMember);
        const needed = memberParticipants.length > 0 ? memberParticipants : [...MEMBER_EMPNOS];
        const everyoneRated = needed.every((emp) =>
          rs.some((r) => r.reviewerId === emp && r.rating > 0),
        );
        if (!everyoneRated) continue;
        const r = averageRating(rs);
        if (r != null) ratings.push(r);
      }
      if (ratings.length === 0) continue;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (avg > bestAvg + 1e-9) {
        bestAvg = avg;
        bestPlaces.length = 0;
        bestPlaces.push({ name: place.name, count: ratings.length });
      } else if (Math.abs(avg - bestAvg) <= 1e-9) {
        bestPlaces.push({ name: place.name, count: ratings.length });
      }
    }
    if (bestPlaces.length > 0) {
      list.push({
        key: 'best',
        title: '최고 맛집',
        emoji: '🏅',
        winner: bestPlaces.map((p) => p.name).join(' · '),
        detail:
          `평균 ⭐ ${bestAvg.toFixed(1)}` +
          (bestPlaces.length === 1
            ? ` · 전원 리뷰 ${bestPlaces[0].count}번`
            : ` · 공동 1위 ${bestPlaces.length}곳`),
      });
    }

    // 🔁 가장 많이 간 곳: 방문 횟수 최다 (2회 이상일 때만 의미 있음)
    const most = Object.values(byPlace).reduce<{ name: string; count: number } | null>(
      (acc, place) =>
        !acc || place.records.length > acc.count
          ? { name: place.name, count: place.records.length }
          : acc,
      null,
    );
    if (most && most.count >= 2) {
      list.push({
        key: 'most',
        title: '가장 많이 간 곳',
        emoji: '🔁',
        winner: most.name,
        detail: `${most.count}번 방문`,
      });
    }

    // 🗓️ 먹부림: 기록(done)이 가장 많았던 달 + 요일 (각각 2번 이상일 때만, 동점은 병기)
    const byMonth: Record<string, number> = {};
    const byWeekday: Record<number, number> = {};
    for (const l of doneThisYear) {
      const m = l.date.slice(5, 7);
      byMonth[m] = (byMonth[m] ?? 0) + 1;
      const wd = new Date(`${l.date}T00:00:00`).getDay();
      byWeekday[wd] = (byWeekday[wd] ?? 0) + 1;
    }
    const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
    const monthMax = Math.max(0, ...Object.values(byMonth));
    const weekdayMax = Math.max(0, ...Object.values(byWeekday));
    const topMonths =
      monthMax >= 2
        ? Object.entries(byMonth)
            .filter(([, n]) => n === monthMax)
            .map(([m]) => `${Number(m)}월`)
        : [];
    const topWeekdays =
      weekdayMax >= 2
        ? Object.entries(byWeekday)
            .filter(([, n]) => n === weekdayMax)
            .map(([wd]) => `${WEEKDAY_NAMES[Number(wd)]}요일`)
        : [];
    if (topMonths.length > 0 || topWeekdays.length > 0) {
      list.push({
        key: 'binge',
        title: '먹부림 피크',
        emoji: '🗓️',
        winner: [...topMonths, ...topWeekdays].join(' · '),
        lines: [
          ...(topMonths.length > 0 ? [`달 최다 — ${topMonths.join(' · ')} (${monthMax}번)`] : []),
          ...(topWeekdays.length > 0
            ? [`요일 최다 — ${topWeekdays.join(' · ')} (${weekdayMax}번)`]
            : []),
        ],
      });
    }

    // 🔥 최장 연속 주간: 먹은 날짜 기준 — 기록이 있는 주(월요일 시작)가 몇 주 연속 이어졌는지
    const weekStarts = new Set<string>();
    for (const l of doneThisYear) {
      weekStarts.add(
        format(startOfWeek(new Date(`${l.date}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      );
    }
    const sortedWeeks = [...weekStarts].sort();
    let bestRun = 0;
    let bestStart = '';
    let bestEnd = '';
    let run = 0;
    let runStart = '';
    let prevWeek: string | null = null;
    for (const w of sortedWeeks) {
      const consecutive =
        prevWeek !== null &&
        differenceInCalendarDays(new Date(`${w}T00:00:00`), new Date(`${prevWeek}T00:00:00`)) === 7;
      if (consecutive) {
        run += 1;
      } else {
        run = 1;
        runStart = w;
      }
      if (run > bestRun) {
        bestRun = run;
        bestStart = runStart;
        bestEnd = w;
      }
      prevWeek = w;
    }
    if (bestRun >= 2) {
      const thisWeek = format(
        startOfWeek(new Date(`${todayKey}T00:00:00`), { weekStartsOn: 1 }),
        'yyyy-MM-dd',
      );
      const ongoing = bestEnd === thisWeek;
      // 주 시작(월요일) 날짜를 "M월 n주차"로 — 그 달의 몇 번째 주(7일 단위)인지 기준
      const weekLabel = (weekStart: string) => {
        const d = new Date(`${weekStart}T00:00:00`);
        return `${d.getMonth() + 1}월 ${Math.ceil(d.getDate() / 7)}주차`;
      };
      list.push({
        key: 'streak',
        title: '최장 연속 주간',
        emoji: '🔥',
        winner: `${bestRun}주 연속`,
        detail: `${weekLabel(bestStart)} ~ ${weekLabel(bestEnd)}${ongoing ? ' · 진행 중 🔥' : ''}`,
      });
    }

    // ✍️ 리뷰왕: 올해 기록에 평을 가장 많이 남긴 사람
    // + 입맛 성향: 별점 평균 최고(😇 천사 입맛)/최저(🌶️ 깐깐 미식가) — 3개 이상 남긴 사람만
    const reviewCount: Record<string, number> = {};
    const ratingTotals: Record<string, { sum: number; n: number }> = {};
    for (const l of doneThisYear) {
      for (const r of reviews[l.id] ?? []) {
        reviewCount[r.reviewerId] = (reviewCount[r.reviewerId] ?? 0) + 1;
        if (r.rating > 0) {
          const t = (ratingTotals[r.reviewerId] ??= { sum: 0, n: 0 });
          t.sum += r.rating;
          t.n += 1;
        }
      }
    }
    const reviewMax = Math.max(0, ...Object.values(reviewCount));
    if (reviewMax > 0) {
      const winners = Object.entries(reviewCount)
        .filter(([, n]) => n === reviewMax)
        .map(([id]) => memberName(id));
      const tasters = Object.entries(ratingTotals)
        .filter(([, t]) => t.n >= 3)
        .map(([id, t]) => ({ id, avg: t.sum / t.n }));
      const lines: string[] = [];
      if (tasters.length >= 2) {
        const maxAvg = Math.max(...tasters.map((t) => t.avg));
        const minAvg = Math.min(...tasters.map((t) => t.avg));
        // 전원 평균이 같으면 성향 구분이 무의미하니 생략
        if (maxAvg - minAvg > 0.001) {
          const names = (avg: number) =>
            tasters
              .filter((t) => Math.abs(t.avg - avg) < 0.001)
              .map((t) => memberName(t.id))
              .join(' · ');
          lines.push(`😇 천사 입맛 ${names(maxAvg)} — 평균 ⭐ ${maxAvg.toFixed(1)}`);
          lines.push(`🌶️ 깐깐 미식가 ${names(minAvg)} — 평균 ⭐ ${minAvg.toFixed(1)}`);
        }
      }
      list.push({
        key: 'review',
        title: '리뷰왕',
        emoji: '✍️',
        winner: winners.join(' · '),
        detail: `평 ${reviewMax}개`,
        lines: lines.length > 0 ? lines : undefined,
      });
    }

    // 🍱 도시락왕: 근태 조회가 끝난 뒤에 합류 — 전원 순위(일수·절약액)까지 표시
    if (dosirakRank) {
      const top = dosirakRank[0].days;
      const winners = dosirakRank.filter((r) => r.days === top).map((r) => r.name);
      const medals = ['🥇', '🥈', '🥉'];
      list.push({
        key: 'dosirak',
        title: '도시락왕',
        emoji: '🍱',
        winner: winners.join(' · '),
        lines: dosirakRank.map((r) => {
          // 동점자는 같은 등수 메달 (예: 45·45·30일 → 🥇🥇🥉)
          const place = dosirakRank.filter((o) => o.days > r.days).length;
          return `${medals[place] ?? '🍙'} ${r.name} — ${r.days}일 · 약 ${(r.days * 8000).toLocaleString()}원 절약`;
        }),
      });
    }

    return list;
  }, [doneThisYear, reviews, memberName, dosirakRank, todayKey]);

  // 올해 함께 먹은 횟수 요약 — 쪼물런치는 외식/배달 구분, 쪼물디너는 합계만
  const counts = useMemo(() => {
    let lunchOut = 0;
    let lunchDelivery = 0;
    let dinner = 0;
    for (const l of doneThisYear) {
      if (l.meal === 'dinner') dinner += 1;
      else if (l.delivery) lunchDelivery += 1;
      else lunchOut += 1;
    }
    return { lunch: lunchOut + lunchDelivery, lunchOut, lunchDelivery, dinner };
  }, [doneThisYear]);

  if (awards.length === 0 && doneThisYear.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <LuChevronRight className="text-ink-400" />
        ) : (
          <LuChevronDown className="text-ink-400" />
        )}
        <h2 className="text-sm font-semibold tracking-tight">🏆 {year} 먹기록 어워드</h2>
      </button>
      {collapsed ? null : (
        <>
          {/* 올해 함께 먹은 횟수 — 좁은 화면에선 줄바꿈되는 칩 */}
          {counts.lunch + counts.dinner > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-baseline gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 whitespace-nowrap">
                🍜 쪼물런치 <b className="text-ink-900">{counts.lunch}번</b>
                <span className="text-ink-400">
                  (외식 {counts.lunchOut} · 배달 {counts.lunchDelivery})
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 whitespace-nowrap">
                🌙 쪼물디너 <b className="text-ink-900">{counts.dinner}번</b>
              </span>
            </div>
          ) : null}
          {awards.length > 0 ? (
            <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {awards.map((a) => (
                <li key={a.key} className="rounded-xl border border-amber-100 bg-white px-3 py-2 min-w-0">
                  <p className="text-[10px] font-medium text-ink-400">{a.title}</p>
                  {/* 자르지 않고 단어 단위로 줄바꿈 (최대 2줄) — 모바일에서 가게명이 어색하게 잘리지 않게 */}
                  <p
                    className="text-sm font-semibold text-ink-900 mt-0.5 break-keep line-clamp-2"
                    title={a.winner}
                  >
                    {a.emoji} {a.winner}
                  </p>
                  {a.detail ? <p className="text-[11px] text-ink-500 mt-0.5">{a.detail}</p> : null}
                  {a.lines ? (
                    <ul className="mt-1 space-y-0.5">
                      {a.lines.map((line) => (
                        <li key={line} className="text-[11px] text-ink-500 break-keep leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[10px] text-ink-400 break-keep">
            올해({year}년) 다녀온 기록 기준이에요 · 최고 맛집은 참여자 전원이 별점을 남긴
            기록만 집계해요 · 도시락왕은 도시락 리포트와 같은 규칙으로 계산해요 (연차·오전
            반차 제외)
          </p>
        </>
      )}
    </section>
  );
}
