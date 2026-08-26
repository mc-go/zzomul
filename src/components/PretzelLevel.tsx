import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX, LuChevronRight } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import { DB_WRITE_EVENT } from '../lib/db';
import {
  computeLevelUps,
  fetchAllActivityDates,
  fetchRecentActivities,
  fetchTeamActivity,
  levelFromExp,
  totalExp,
  type ActivityCounts,
  type LevelUp,
  type RecentActivity,
  type TeamLevel,
} from '../lib/pretzel-level';
import { useAppData } from '../contexts/AppDataContext';

// 프레첼 키우기 — 헤더 로고 옆 레벨 뱃지. 팀 활동(기록·리뷰·보고·댓글·메모·투표)이
// 곧 경험치라서, 뭔가 저장될 때마다(DB 쓰기 이벤트) 다시 계산한다.
// 뱃지 클릭 → 요약 패널(진행 바·활동별 개수) → "상세 내역" 버튼 → 팝업으로
// 레벨업 타임라인 + 최근 경험치 로그를 보여준다.

const MIN_REFRESH_MS = 15 * 1000;

const KIND_META: Record<RecentActivity['kind'], { emoji: string; label: string }> = {
  lunch: { emoji: '🍜', label: '먹기록' },
  review: { emoji: '✍️', label: '리뷰' },
  report: { emoji: '📢', label: '보고' },
  comment: { emoji: '💬', label: '댓글' },
  memo: { emoji: '📝', label: '메모' },
  vote: { emoji: '⚖️', label: '투표' },
};

// SQLite datetime('now')은 UTC — 로컬 날짜로 짧게 표시
function shortTime(at: string): string {
  if (!at) return '';
  const iso = at.includes('T') ? at : `${at.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yy.M.d (EEE)', { locale: ko });
}

function CountChips({ counts }: { counts: ActivityCounts }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(
        [
          ['🍜 기록', counts.lunches],
          ['✍️ 리뷰', counts.reviews],
          ['📢 보고', counts.reports],
          ['💬 댓글', counts.comments],
          ['📝 메모', counts.memos],
          ['⚖️ 투표', counts.votes],
        ] as const
      ).map(([label, n]) => (
        <span
          key={label}
          className="rounded-full border border-ink-100 bg-ink-50/50 px-1.5 py-0.5 text-[10px] text-ink-600 whitespace-nowrap"
        >
          {label} {n}
        </span>
      ))}
    </div>
  );
}

export default function PretzelLevel() {
  const [info, setInfo] = useState<TeamLevel | null>(null);
  const [counts, setCounts] = useState<ActivityCounts | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const lastFetchRef = useRef(0);
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      lastFetchRef.current = Date.now();
      const c = await fetchTeamActivity();
      if (cancelled) return;
      const next = levelFromExp(totalExp(c));
      // 세션 중 레벨이 오르면 뱃지가 팡 하고 강조됨
      if (prevLevelRef.current !== null && next.level > prevLevelRef.current) {
        setLeveledUp(true);
        setTimeout(() => setLeveledUp(false), 3000);
      }
      prevLevelRef.current = next.level;
      setCounts(c);
      setInfo(next);
    }
    void refresh();
    const onWrite = () => {
      if (Date.now() - lastFetchRef.current < MIN_REFRESH_MS) return;
      void refresh();
    };
    window.addEventListener(DB_WRITE_EVENT, onWrite);
    return () => {
      cancelled = true;
      window.removeEventListener(DB_WRITE_EVENT, onWrite);
    };
  }, []);

  if (!info) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center h-5 px-1.5 rounded-full border text-[10px] font-bold transition-colors ${
          leveledUp
            ? 'border-amber-300 bg-amber-100 text-amber-700 animate-pop'
            : 'border-pretzel/30 bg-pretzel/10 text-pretzel hover:bg-pretzel/20'
        }`}
        title="팀 프레첼 레벨 — 먹고 쓰고 투표할수록 자라요"
        aria-expanded={open}
      >
        {leveledUp ? '🎉 ' : ''}Lv.{info.level}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-ink-100 bg-white shadow-lg p-3">
            <p className="text-xs font-bold text-ink-900">🥨 팀 프레첼 Lv.{info.level}</p>
            <div className="mt-2 h-2 rounded-full bg-ink-50 border border-ink-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-pretzel transition-all duration-500"
                style={{ width: `${Math.max(info.progress * 100, 3)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-ink-500">
              {info.into}/{info.need} · 다음 레벨까지 활동 {info.need - info.into}개 (누적{' '}
              {info.exp}개)
            </p>
            {counts ? (
              <div className="mt-2.5">
                <CountChips counts={counts} />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDetail(true);
              }}
              className="mt-2.5 w-full h-8 inline-flex items-center justify-center gap-0.5 rounded-full border border-pretzel/30 bg-pretzel/5 text-[11px] font-semibold text-pretzel hover:bg-pretzel/10"
            >
              상세 내역 보기
              <LuChevronRight className="text-xs" />
            </button>
          </div>
        </>
      ) : null}

      {/* 상세 팝업은 body 포털로 — 헤더 backdrop-blur가 fixed 기준점을 가로채는 것 방지 */}
      {detail
        ? createPortal(
            <PretzelDetailModal info={info} counts={counts} onClose={() => setDetail(false)} />,
            document.body,
          )
        : null}
    </div>
  );
}

// 상세 팝업 — 레벨업 타임라인(언제 몇 레벨을 달성했는지) + 최근 경험치 로그
function PretzelDetailModal({
  info,
  counts,
  onClose,
}: {
  info: TeamLevel;
  counts: ActivityCounts | null;
  onClose: () => void;
}) {
  const { resolveName } = useAppData();
  const [levelUps, setLevelUps] = useState<LevelUp[] | null>(null);
  const [recent, setRecent] = useState<RecentActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dates, recents] = await Promise.all([
        fetchAllActivityDates(),
        fetchRecentActivities(10),
      ]);
      if (cancelled) return;
      setLevelUps(computeLevelUps(dates).reverse()); // 최신 레벨업이 위로
      setRecent(recents);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[85vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-1.5">
            <GiPretzel className="text-pretzel" />팀 프레첼 Lv.{info.level}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4">
          <div>
            <div className="h-2.5 rounded-full bg-ink-50 border border-ink-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-pretzel transition-all duration-500"
                style={{ width: `${Math.max(info.progress * 100, 3)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-500">
              {info.into}/{info.need} · 다음 레벨까지 활동 {info.need - info.into}개 · 누적 경험치{' '}
              {info.exp}개
            </p>
            {counts ? (
              <div className="mt-2">
                <CountChips counts={counts} />
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">📈 레벨업 히스토리</h3>
            {levelUps === null ? (
              <p className="text-[11px] text-ink-300">불러오는 중...</p>
            ) : levelUps.length === 0 ? (
              <p className="text-[11px] text-ink-300">아직 첫 레벨업 전이에요 — 조금만 더!</p>
            ) : (
              <ul className="space-y-1">
                {levelUps.map((u) => (
                  <li
                    key={u.level}
                    className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-bold text-amber-700">Lv.{u.level}</span>
                    <span className="text-ink-500">달성</span>
                    <span className="ml-auto text-ink-400">{shortTime(u.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">🕐 최근 경험치</h3>
            <ul className="space-y-0.5">
              {recent.map((r, i) => {
                const meta = KIND_META[r.kind];
                // 기록은 만든 사람(userId) 대신 가게명이 더 유용
                const who = r.kind === 'lunch' ? r.label : r.actor ? resolveName(r.actor) : '';
                return (
                  <li
                    key={`${r.kind}-${r.at}-${i}`}
                    className="flex items-center gap-1.5 text-[11px] text-ink-600"
                  >
                    <span className="shrink-0">{meta.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {who ? `${who} · ` : ''}
                      {meta.label} +1
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-300">{shortTime(r.at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-[10px] text-ink-400 break-keep">
            먹기록·리뷰·보고·댓글·메모·투표 하나하나가 경험치 1이에요. 레벨 필요치는 10부터
            5씩 늘어나요.
          </p>
        </div>
      </div>
    </div>
  );
}
