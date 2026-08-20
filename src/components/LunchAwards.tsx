import { useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';
import type { Lunch } from '../lib/lunches';
import { averageRating, type LunchReview } from '../lib/reviews';
import { fetchAttendances, indexByMemberAndDate } from '../lib/attendance';
import { ensureLunchPlansSchema, listLunchPlans } from '../lib/lunch-plans';
import { buildLunchesByDate, buildPlansByDate, computeDosirakStats } from '../lib/lunch-stats';
import { MEMBER_EMPNOS } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';

// 올해의 먹기록 어워드 — 먹기록 탭 맨 위 요약 카드.
// 전부 렌더링 시 계산만 하고 DB 저장은 없음.
// 도시락왕만 근태 데이터가 필요해서 올해치 근태를 따로 한 번 조회한다 (게스트는 생략).

const COLLAPSE_KEY = 'zzomul.awards.collapsed.v1';

// 가게명 비교용 정규화 — 공백/대소문자 차이는 같은 가게로 본다 (단골 뱃지와 동일 규칙)
export function normalizeRestaurant(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

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

    // 🏅 최고 맛집: 가게별 별점 평균(리뷰 평균 우선, 없으면 기록 별점)이 가장 높은 곳
    let best: { name: string; avg: number; count: number } | null = null;
    for (const place of Object.values(byPlace)) {
      const ratings: number[] = [];
      for (const l of place.records) {
        const r = averageRating(reviews[l.id] ?? []) ?? (l.rating > 0 ? l.rating : null);
        if (r != null) ratings.push(r);
      }
      if (ratings.length === 0) continue;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (!best || avg > best.avg || (avg === best.avg && ratings.length > best.count)) {
        best = { name: place.name, avg, count: ratings.length };
      }
    }
    if (best) {
      list.push({
        key: 'best',
        title: '최고 맛집',
        emoji: '🏅',
        winner: best.name,
        detail: `평균 ⭐ ${best.avg.toFixed(1)}`,
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

    // 🛵 배달왕: 배달 기록에 가장 많이 낀 사람
    const deliveryCount: Record<string, number> = {};
    for (const l of doneThisYear) {
      if (!l.delivery) continue;
      for (const p of l.participants) deliveryCount[p] = (deliveryCount[p] ?? 0) + 1;
    }
    const deliveryMax = Math.max(0, ...Object.values(deliveryCount));
    if (deliveryMax > 0) {
      const winners = Object.entries(deliveryCount)
        .filter(([, n]) => n === deliveryMax)
        .map(([id]) => memberName(id));
      list.push({
        key: 'delivery',
        title: '배달왕',
        emoji: '🛵',
        winner: winners.join(' · '),
        detail: `배달 ${deliveryMax}번`,
      });
    }

    // ✍️ 리뷰왕: 올해 기록에 평을 가장 많이 남긴 사람
    const reviewCount: Record<string, number> = {};
    for (const l of doneThisYear) {
      for (const r of reviews[l.id] ?? []) {
        reviewCount[r.reviewerId] = (reviewCount[r.reviewerId] ?? 0) + 1;
      }
    }
    const reviewMax = Math.max(0, ...Object.values(reviewCount));
    if (reviewMax > 0) {
      const winners = Object.entries(reviewCount)
        .filter(([, n]) => n === reviewMax)
        .map(([id]) => memberName(id));
      list.push({
        key: 'review',
        title: '리뷰왕',
        emoji: '✍️',
        winner: winners.join(' · '),
        detail: `평 ${reviewMax}개`,
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
  }, [doneThisYear, reviews, memberName, dosirakRank]);

  if (awards.length === 0) return null;

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
          <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {awards.map((a) => (
              <li key={a.key} className="rounded-xl border border-amber-100 bg-white px-3 py-2">
                <p className="text-[10px] font-medium text-ink-400">{a.title}</p>
                <p className="text-sm font-semibold text-ink-900 mt-0.5 truncate" title={a.winner}>
                  {a.emoji} {a.winner}
                </p>
                {a.detail ? <p className="text-[11px] text-ink-500 mt-0.5">{a.detail}</p> : null}
                {a.lines ? (
                  <ul className="mt-1 space-y-0.5">
                    {a.lines.map((line) => (
                      <li key={line} className="text-[11px] text-ink-500">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-400">
            올해({year}년) 다녀온 기록 기준이에요 · 도시락왕은 도시락 리포트와 같은 규칙으로
            세요 (연차·오전 반차 제외)
          </p>
        </>
      )}
    </section>
  );
}
