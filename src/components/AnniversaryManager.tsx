import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX, LuTrash2, LuPlus, LuPencil, LuCheck } from 'react-icons/lu';
import {
  createAnniversary,
  deleteAnniversary,
  updateAnniversary,
  emojiFor,
  type Anniversary,
  type AnniversaryKind,
  type RepeatMode,
} from '../lib/anniversaries';
import { ALL_PARTICIPANT_IDS, MEMBER_EMPNOS } from '../lib/members';

const KIND_OPTIONS: { key: AnniversaryKind; label: string; emoji: string }[] = [
  { key: 'birthday', label: '생일', emoji: '🎂' },
  { key: 'hire', label: '입사', emoji: '🌱' },
  { key: 'wedding', label: '결혼', emoji: '💍' },
  { key: 'custom', label: '기타', emoji: '🎉' },
];

const REMIND_OPTIONS = [1, 3, 7]; // 며칠 전 알림 (당일은 항상 팝업)

// 기념일 목록 + 추가/삭제 모달. 데이터는 전부 DB(anniversaries 테이블)에 저장.
export default function AnniversaryManager({
  items,
  myPid,
  resolveName,
  onClose,
  onChanged,
}: {
  items: Anniversary[];
  myPid: string;
  resolveName: (id: string) => string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Anniversary | null>(null);
  const [kind, setKind] = useState<AnniversaryKind>('birthday');
  const [ownerId, setOwnerId] = useState<string>(MEMBER_EMPNOS[0]);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [customRepeat, setCustomRepeat] = useState<RepeatMode>('yearly');
  const [remindDays, setRemindDays] = useState<number[]>([1, 7]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 기타 종류는 팀 공용(주인 없음)도 가능
  const isCustom = kind === 'custom';
  // 반복 방식: 입사=100일 단위, 생일/결혼=매년 고정. 기타만 직접 선택(매년/100일/일회성).
  const repeat: RepeatMode = kind === 'hire' ? 'every100days' : isCustom ? customRepeat : 'yearly';

  function toggleRemind(d: number) {
    setRemindDays((prev) => (prev.includes(d) ? prev.filter((v) => v !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  // 기존 기념일을 폼에 채워 수정 모드로 전환
  function startEdit(item: Anniversary) {
    setEditing(item);
    setKind(item.kind);
    setOwnerId(item.ownerId);
    setLabel(item.label);
    setDate(item.date);
    setCustomRepeat(item.repeat);
    setRemindDays([...item.remindDays]);
    setErr(null);
  }

  function resetForm() {
    setEditing(null);
    setKind('birthday');
    setOwnerId(MEMBER_EMPNOS[0]);
    setLabel('');
    setDate('');
    setCustomRepeat('yearly');
    setRemindDays([1, 7]);
    setErr(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!date) {
      setErr('날짜를 선택해 주세요.');
      return;
    }
    if (isCustom && !ownerId && !label.trim()) {
      setErr('기타 기념일은 이름을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ownerId: isCustom ? ownerId : ownerId || MEMBER_EMPNOS[0],
        kind,
        label: label.trim(),
        date,
        repeat,
        remindDays,
      };
      if (editing) {
        // 수정: 기존 이모지(예: 쪼물랭 🥨)는 유지
        await updateAnniversary({ ...payload, id: editing.id, emoji: editing.emoji });
      } else {
        await createAnniversary({ ...payload, emoji: '', createdBy: myPid });
      }
      resetForm();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Anniversary) {
    if (!confirm('이 기념일을 삭제할까요?')) return;
    try {
      await deleteAnniversary(item.id);
      if (editing?.id === item.id) resetForm(); // 수정 중이던 항목이 삭제되면 폼 초기화
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  function itemTitle(item: Anniversary): string {
    const name = item.ownerId ? resolveName(item.ownerId) : '';
    const kindLabel = KIND_OPTIONS.find((k) => k.key === item.kind)?.label ?? '기타';
    if (item.kind === 'custom') return item.label || (name ? `${name} 기념일` : '기념일');
    return `${name} ${kindLabel}`;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">🎉 기념일 관리</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 등록된 기념일 목록 */}
          {items.length === 0 ? (
            <p className="text-xs text-ink-400 text-center py-2">아직 등록된 기념일이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    editing?.id === item.id
                      ? 'border-amber-300 bg-amber-50/60'
                      : 'border-ink-100 bg-ink-50/40'
                  }`}
                >
                  <span className="text-lg">{emojiFor(item)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink-800 truncate">{itemTitle(item)}</p>
                    <p className="text-[10px] text-ink-400">
                      {format(new Date(item.date), 'yyyy년 M월 d일', { locale: ko })}
                      {item.kind === 'hire'
                        ? ' · 100일 단위 + 매년'
                        : item.repeat === 'every100days'
                          ? ' · 100일 단위'
                          : item.repeat === 'once'
                            ? ' · 일회성'
                            : ' · 매년'}
                      {item.remindDays.length > 0
                        ? ` · ${item.remindDays.map((d) => `${d}일 전`).join(', ')} 알림`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="text-ink-300 hover:text-ink-900 p-1.5 rounded hover:bg-ink-100 shrink-0"
                    aria-label="수정"
                    title="수정"
                  >
                    <LuPencil className="text-sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="text-ink-300 hover:text-red-600 p-1.5 rounded hover:bg-red-50 shrink-0"
                    aria-label="삭제"
                    title="삭제"
                  >
                    <LuTrash2 className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 새 기념일 추가 */}
          <form onSubmit={submit} className="space-y-3 border-t border-ink-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-700">
                {editing ? `✏️ 기념일 수정 — ${itemTitle(editing)}` : '새 기념일 추가'}
              </p>
              {editing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-ink-400 hover:text-ink-900 hover:underline underline-offset-2"
                >
                  수정 취소
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {KIND_OPTIONS.map((opt) => {
                const active = kind === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setKind(opt.key)}
                    className={`h-10 px-1 rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                );
              })}
            </div>

            <div>
              <span className="block text-[11px] font-medium text-ink-500 mb-1.5">누구의 기념일인가요?</span>
              <div className="grid grid-cols-4 gap-2">
                {/* 멤버 + 계정 없는 추가 인물(박소현 등) 모두 선택 가능 */}
                {ALL_PARTICIPANT_IDS.map((pid) => {
                  const active = ownerId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setOwnerId(pid)}
                      className={`h-10 px-1 rounded-md border text-xs font-medium transition-colors ${
                        active
                          ? 'bg-ink-900 text-white border-ink-900'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                      }`}
                    >
                      {resolveName(pid)}
                    </button>
                  );
                })}
                {isCustom ? (
                  <button
                    type="button"
                    onClick={() => setOwnerId('')}
                    className={`h-10 px-1 rounded-md border text-xs font-medium transition-colors ${
                      ownerId === ''
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                    }`}
                  >
                    🥨 팀 공용
                  </button>
                ) : null}
              </div>
            </div>

            {isCustom ? (
              <>
                <div>
                  <span className="block text-[11px] font-medium text-ink-500 mb-1.5">기념일 이름</span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="예: 쪼물랭, 첫 회식"
                    className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm placeholder-ink-300"
                  />
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-ink-500 mb-1.5">반복</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: 'yearly', label: '매년' },
                        { key: 'every100days', label: '100일 단위' },
                        { key: 'once', label: '일회성' },
                      ] as { key: RepeatMode; label: string }[]
                    ).map((opt) => {
                      const active = customRepeat === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setCustomRepeat(opt.key)}
                          className={`h-10 px-1 rounded-md border text-xs font-medium transition-colors ${
                            active
                              ? 'bg-ink-900 text-white border-ink-900'
                              : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            <div>
              <span className="block text-[11px] font-medium text-ink-500 mb-1.5">
                기준일 {kind === 'hire' ? '(입사일 — 100일 단위 + 매년 주년으로 표시)' : kind === 'birthday' ? '(태어난 해는 아무 해나 OK)' : ''}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-ink-200 text-sm"
              />
            </div>

            <div>
              <span className="block text-[11px] font-medium text-ink-500 mb-1.5">
                미리 알림 (당일 팝업은 항상 떠요 🎉)
              </span>
              <div className="flex gap-2">
                {REMIND_OPTIONS.map((d) => {
                  const active = remindDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleRemind(d)}
                      className={`h-9 px-3 rounded-full border text-xs font-medium transition-colors ${
                        active
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'
                      }`}
                    >
                      {d}일 전
                    </button>
                  );
                })}
              </div>
            </div>

            {err ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {err}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md bg-ink-900 text-white text-xs font-medium hover:bg-ink-700 disabled:opacity-60"
            >
              {editing ? <LuCheck className="text-sm" /> : <LuPlus className="text-sm" />}
              {busy ? '저장 중...' : editing ? '수정 저장' : '기념일 추가'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
