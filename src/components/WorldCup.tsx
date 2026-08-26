import { useState } from 'react';
import { LuX, LuTrophy } from 'react-icons/lu';
import type { Lunch } from '../lib/lunches';
import { normalizeRestaurant } from '../lib/lunch-stats';
import { createMemo } from '../lib/memos';
import { isYearEndSeason } from '../lib/monthly-recap';

// 맛집 월드컵 — 연말 시즌(12월 마지막 주 한 주 전부터)에만 열리는 이벤트.
// 올해 다녀온 가게로 토너먼트를 돌려 팀 챔피언을 뽑고, 결과는 원하면 메모로 남긴다.
// 게임 코너 타일에서 WorldCupModal을 바로 띄워 쓴다.

export function isWorldCupSeason(date: Date): boolean {
  return isYearEndSeason(date);
}

export type Contender = { key: string; name: string; count: number };

// 올해 다녀온 가게 목록 → 방문수 상위로 4/8/16강 대진 (4곳 미만이면 null)
export function buildContenders(lunches: Lunch[], year: string): Contender[] | null {
  const byPlace: Record<string, Contender> = {};
  for (const l of lunches) {
    if (l.status !== 'done' || !l.date.startsWith(year)) continue;
    const key = normalizeRestaurant(l.restaurant);
    if (!key) continue;
    (byPlace[key] ??= { key, name: l.restaurant, count: 0 }).count += 1;
  }
  const sorted = Object.values(byPlace).sort((a, b) => b.count - a.count);
  if (sorted.length < 4) return null;
  const size = sorted.length >= 16 ? 16 : sorted.length >= 8 ? 8 : 4;
  const picked = sorted.slice(0, size);
  // 대진은 돌릴 때마다 섞여야 재미있으니 비결정적 셔플
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

const ROUND_NAME: Record<number, string> = { 16: '16강', 8: '8강', 4: '4강', 2: '결승' };

export function WorldCupModal({
  initial,
  year,
  myName,
  myPid,
  onClose,
}: {
  initial: Contender[];
  year: string;
  myName: string;
  myPid: string;
  onClose: () => void;
}) {
  const [round, setRound] = useState<Contender[]>(initial); // 현재 라운드 참가자
  const [next, setNext] = useState<Contender[]>([]); // 다음 라운드 진출자
  const [pairIndex, setPairIndex] = useState(0);
  const [champion, setChampion] = useState<Contender | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalPairs = round.length / 2;
  const a = round[pairIndex * 2];
  const b = round[pairIndex * 2 + 1];

  function pick(winner: Contender) {
    const advanced = [...next, winner];
    if (pairIndex + 1 < totalPairs) {
      setNext(advanced);
      setPairIndex(pairIndex + 1);
      return;
    }
    // 라운드 종료
    if (advanced.length === 1) {
      setChampion(advanced[0]);
      return;
    }
    setRound(advanced);
    setNext([]);
    setPairIndex(0);
  }

  async function saveResult() {
    if (!champion || saving || saved || !myPid) return;
    setSaving(true);
    try {
      await createMemo(myPid, `🏆 ${year} 맛집 월드컵 우승: ${champion.name}! (${myName} 진행)`);
      setSaved(true);
    } catch {
      alert('메모 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">
            🏟️ 맛집 월드컵{' '}
            {!champion ? (
              <span className="text-xs text-ink-400 font-normal">
                {ROUND_NAME[round.length] ?? `${round.length}강`} · {pairIndex + 1}/{totalPairs}
              </span>
            ) : null}
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

        <div className="p-5 overflow-y-auto">
          {champion ? (
            <div className="text-center py-4">
              <LuTrophy className="mx-auto text-4xl text-amber-400" />
              <p className="mt-3 text-lg font-bold text-ink-900 break-keep">{champion.name}</p>
              <p className="mt-1 text-xs text-ink-500">
                {year}년 우리 팀의 챔피언! (올해 {champion.count}번 방문)
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                {myPid ? (
                  <button
                    type="button"
                    onClick={saveResult}
                    disabled={saving || saved}
                    className="h-9 px-4 rounded-full bg-ink-900 text-white text-xs font-semibold hover:bg-pretzel disabled:opacity-60"
                  >
                    {saved ? '메모에 남겼어요 ✅' : saving ? '남기는 중...' : '아무거나에 결과 남기기'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-full border border-ink-200 text-ink-600 text-xs font-medium hover:bg-ink-50"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-center text-xs text-ink-500 mb-3">더 끌리는 곳을 골라요 👇</p>
              <div className="flex items-stretch gap-2">
                {[a, b].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => pick(c)}
                    className="flex-1 min-w-0 rounded-2xl border-2 border-ink-200 bg-white px-3 py-6 text-center transition-all hover:border-indigo-400 hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    <p className="text-sm font-bold text-ink-900 break-keep">{c.name}</p>
                    <p className="mt-1 text-[10px] text-ink-400">올해 {c.count}번</p>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-ink-300">VS</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
