import { useEffect, useState, type FormEvent } from 'react';
import { LuX } from 'react-icons/lu';
import {
  ensureSettingsSchema,
  getSetting,
  setSetting,
  savingsGoalKey,
  dosirakKcalKey,
} from '../lib/settings';

// 웰빙 저금통 팝업 (절약 목표액 + 도시락 한 끼 칼로리) — 헤더 ⚙️ 설정 메뉴에서 열림.
// 목표액은 연 단위·사람별(settings의 savings.goal.{연도}.{사번}),
// 도시락 한 끼 칼로리는 사람별·연도 무관(dosirak.kcal.{사번}) — 각자 도시락이 달라서 개인 설정.
// 둘 다 비우고 저장하면 해제.

export default function SavingsGoalEditor({
  empNo,
  year,
  displayName,
  onClose,
}: {
  empNo: string;
  year: string;
  displayName: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [kcal, setKcal] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSettingsSchema()
      .then(() =>
        Promise.all([getSetting(savingsGoalKey(empNo, year)), getSetting(dosirakKcalKey(empNo))]),
      )
      .then(([goal, kc]) => {
        if (cancelled) return;
        const g = Number(goal);
        setValue(g > 0 ? String(g) : '');
        const k = Number(kc);
        setKcal(k > 0 ? String(k) : '');
      })
      .catch(() => {
        /* 로드 실패해도 새로 입력해서 저장 가능 */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [empNo, year]);

  const amount = Number(value.replace(/[^0-9]/g, ''));
  const kcalNum = Number(kcal.replace(/[^0-9]/g, ''));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !loaded) return;
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([
        setSetting(savingsGoalKey(empNo, year), amount > 0 ? String(amount) : ''),
        setSetting(dosirakKcalKey(empNo), kcalNum > 0 ? String(kcalNum) : ''),
      ]);
      onClose();
    } catch {
      setErr('저장에 실패했어요. 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          {/* 메뉴는 "웰빙 저금통 설정", 팝업 제목은 "관리" — 기념일 설정/관리와 같은 패턴 */}
          <h2 className="text-base font-semibold">🐷 웰빙 저금통 관리</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="rounded-xl bg-ink-50/60 border border-ink-100 px-3.5 py-3">
            <p className="text-xs font-medium text-ink-700">
              <b>{displayName}</b>님의 웰빙 저금통
            </p>
            <ul className="mt-1.5 text-[11px] text-ink-500 space-y-1 break-keep">
              <li>🍱 도시락으로 아낀 돈과 챙긴 건강을 같이 모아요</li>
              <li>📊 진행률은 캘린더 도시락 리포트의 이름 옆 게이지에 보여요</li>
              <li>🗓️ 2026년은 8월부터 집계돼요</li>
            </ul>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-ink-500 mb-1.5">
              💰 {year}년 절약 목표액 (원)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="예: 500000"
              disabled={!loaded}
              autoFocus
              className="w-full h-11 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300 disabled:bg-ink-50"
            />
            <p className="mt-1 text-[11px] text-ink-400">
              {amount > 0
                ? `목표: ${amount.toLocaleString()}원 (도시락 약 ${Math.ceil(amount / 8000)}일)`
                : '비우고 저장하면 목표가 해제돼요'}
            </p>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-ink-500 mb-1.5">
              🔥 내 도시락 한 끼 칼로리 (kcal)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="예: 550"
              disabled={!loaded}
              className="w-full h-11 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300 disabled:bg-ink-50"
            />
            <p className="mt-1 text-[11px] text-ink-400">
              {kcalNum > 0
                ? `도시락 하루 = ${kcalNum.toLocaleString()}kcal — 리포트·도시락왕에 함께 표시돼요`
                : '비우고 저장하면 칼로리 표시가 꺼져요 (연도와 무관한 내 도시락 정보)'}
            </p>
          </div>
          {err ? (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {err}
            </div>
          ) : null}
        </form>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-sm rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !loaded}
            className="h-10 px-5 text-sm rounded-full bg-ink-900 text-white hover:bg-pretzel disabled:opacity-60"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
