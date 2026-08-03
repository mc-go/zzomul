import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX } from 'react-icons/lu';
import Avatar from './Avatar';
import type { Profile } from '../lib/profiles';

const STATUS_MAX = 40;

type Props = {
  displayName: string;
  profile: Profile | null;
  initialMessage: string;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
};

export default function StatusEditor({
  displayName,
  profile,
  initialMessage,
  onClose,
  onSubmit,
}: Props) {
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const todayLabel = format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (message.length > STATUS_MAX) {
      setErr(`${STATUS_MAX}자 이내로 써 주세요.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(message.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 flex flex-col"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div>
            <h2 className="text-base font-semibold">오늘의 상태메세지</h2>
            <p className="text-[11px] text-ink-400 mt-0.5">{todayLabel}</p>
          </div>
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
          <div className="flex items-center gap-3">
            <Avatar profile={profile} size="md" fallbackText={displayName} />
            <p className="text-sm font-medium text-ink-900 truncate">{displayName}</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="status-msg" className="text-xs font-medium text-ink-500">
                메시지
              </label>
              <span className="text-[10px] text-ink-400">
                매일 자정 초기화 · {message.length}/{STATUS_MAX}
              </span>
            </div>
            <textarea
              id="status-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, STATUS_MAX))}
              placeholder="오늘 뭐 하고 있는지 짧게 남겨보세요"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none"
              autoFocus
            />
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
            type="submit"
            onClick={submit}
            disabled={busy}
            className="h-10 px-4 text-sm rounded-md bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
