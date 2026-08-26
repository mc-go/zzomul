import { useEffect, useState, type FormEvent } from 'react';
import { LuX, LuPiggyBank } from 'react-icons/lu';
import { ensureSettingsSchema, getSetting, setSetting, savingsGoalKey } from '../lib/settings';

// 절약 목표 설정 팝업 — 헤더 ⚙️ 설정 메뉴에서 열림.
// 목표는 연 단위·사람별(settings의 savings.goal.{연도}.{사번}), 비우고 저장하면 해제.

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
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSettingsSchema()
      .then(() => getSetting(savingsGoalKey(empNo, year)))
      .then((v) => {
        if (cancelled) return;
        const n = Number(v);
        setValue(n > 0 ? String(n) : '');
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

  const digits = value.replace(/[^0-9]/g, '');
  const amount = Number(digits);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !loaded) return;
    setBusy(true);
    setErr(null);
    try {
      await setSetting(savingsGoalKey(empNo, year), amount > 0 ? String(amount) : '');
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
          <h2 className="text-base font-semibold inline-flex items-center gap-1.5">
            <LuPiggyBank className="text-pretzel" />
            {year}년 절약 목표
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

        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-ink-500 break-keep">
            <b className="text-ink-700">{displayName}</b>님의 올해 도시락 절약 목표예요. 캘린더
            도시락 리포트의 이름 옆 게이지로 진행률이 보여요. (2026년은 8월부터 집계)
          </p>
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
          <p className="text-[11px] text-ink-400">
            {amount > 0
              ? `목표: ${amount.toLocaleString()}원 (도시락 약 ${Math.ceil(amount / 8000)}일)`
              : '비우고 저장하면 목표가 해제돼요'}
          </p>
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
