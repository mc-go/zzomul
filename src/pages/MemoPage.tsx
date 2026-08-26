import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuTrash2, LuPencil, LuX, LuStickyNote } from 'react-icons/lu';
import {
  createMemo,
  deleteMemo,
  ensureMemosSchema,
  listMemos,
  updateMemo,
  type Memo,
} from '../lib/memos';
import {
  ensureBalanceSchema,
  getBalanceQuestion,
  listBalanceVotes,
  listBalanceVotesForMonth,
  upsertBalanceVote,
  type BalanceChoice,
  type BalanceVote,
} from '../lib/balance';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import { ensureReviewsSchema, listAllReviews, type LunchReview } from '../lib/reviews';
import { computeBingo } from '../lib/bingo';
import { isValidParticipantId } from '../lib/members';
import { useAuth } from '../contexts/AuthContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import Avatar from '../components/Avatar';
import { BalanceSection } from '../components/DailyPopup';
import BingoSection from '../components/Bingo';
import { WorldCupModal, buildContenders, isWorldCupSeason } from '../components/WorldCup';

export default function MemoPage() {
  const { session } = useAuth();
  const { getProfile, getProfileByEmpNo } = useProfiles();
  const { resolveName, myEmpNo } = useAppData();
  const me = session?.userId ? String(session.userId) : '';
  const myPid = (me ? getProfile(me)?.empNo : '') || myEmpNo || '';

  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Memo | null>(null);
  // 오늘의 밸런스 게임 — 팝업을 닫은 뒤에도 여기서 결과 확인/재투표 가능
  const [todayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const monthKey = todayKey.slice(0, 7);
  const balanceQuestion = getBalanceQuestion(todayKey);
  const [balanceVotes, setBalanceVotes] = useState<BalanceVote[] | null>(null);
  // 게임 코너(빙고·월드컵)용 데이터 — 실패 시 해당 섹션만 생략
  const [lunches, setLunches] = useState<Lunch[] | null>(null);
  const [reviews, setReviews] = useState<Record<number, LunchReview[]>>({});
  const [monthVotes, setMonthVotes] = useState<BalanceVote[]>([]);

  useEffect(() => {
    let cancelled = false;
    ensureBalanceSchema()
      .then(() => listBalanceVotes(todayKey))
      .then((rows) => {
        if (!cancelled) setBalanceVotes(rows);
      })
      .catch(() => {
        /* 조회 실패 시 밸런스 카드만 생략 */
      });
    (async () => {
      try {
        await Promise.all([ensureLunchesSchema(), ensureReviewsSchema()]);
        const [rows, revs, mv] = await Promise.all([
          listLunches(),
          listAllReviews(),
          listBalanceVotesForMonth(monthKey),
        ]);
        if (cancelled) return;
        setLunches(rows);
        setReviews(revs);
        setMonthVotes(mv);
      } catch {
        /* 조회 실패 시 빙고/월드컵만 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [todayKey, monthKey]);

  const bingo = useMemo(
    () => (lunches ? computeBingo(monthKey, lunches, reviews, monthVotes) : null),
    [lunches, reviews, monthVotes, monthKey],
  );
  // 게임 코너 — 타일을 누르면 팝업으로 상세가 열림
  const [openGame, setOpenGame] = useState<'bingo' | 'worldcup' | 'balance' | null>(null);
  const worldcupSeason = isWorldCupSeason(new Date());
  const contenders = useMemo(
    () => (worldcupSeason && lunches ? buildContenders(lunches, todayKey.slice(0, 4)) : null),
    [worldcupSeason, lunches, todayKey],
  );
  const myVote = balanceVotes?.find((v) => v.voterId === myPid)?.choice ?? null;

  async function handleBalanceVote(choice: BalanceChoice) {
    if (!isValidParticipantId(myPid)) return;
    await upsertBalanceVote(todayKey, myPid, choice);
    setBalanceVotes(await listBalanceVotes(todayKey));
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      await ensureMemosSchema();
      const rows = await listMemos();
      setMemos(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !myPid) return;
    const content = draft.trim();
    if (!content) {
      setError('내용을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createMemo(myPid, content);
      setDraft('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 메모를 삭제할까요?')) return;
    try {
      await deleteMemo(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  const canWrite = !!myPid;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight inline-flex items-center gap-2">
          <LuStickyNote className="text-pretzel" />
          아무거나
        </h1>
        <p className="text-xs text-ink-400 mt-0.5">
          {memos.length > 0 ? `총 ${memos.length}개` : '자유롭게 뭐든 적어봐요'}
        </p>
      </div>

      {/* 🎮 게임 코너 — 타일 한 줄(빙고 → 월드컵(연말 한정) → 밸런스), 누르면 팝업으로 상세 */}
      {bingo || balanceVotes !== null ? (
        <div
          className={`mb-6 grid gap-2 ${worldcupSeason ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          {bingo ? (
            <GameTile
              emoji="🎯"
              title="쪼물 빙고"
              status={`${bingo.doneCount}/9칸${bingo.lines > 0 ? ` · ${bingo.lines}줄!` : ''}`}
              accent="lime"
              onClick={() => setOpenGame('bingo')}
            />
          ) : (
            <GameTilePlaceholder />
          )}
          {worldcupSeason ? (
            <GameTile
              emoji="🏟️"
              title="맛집 월드컵"
              status={contenders ? '챔피언 뽑기 · 연말 한정' : '가게 4곳부터 열려요'}
              accent="indigo"
              disabled={!contenders}
              onClick={() => contenders && setOpenGame('worldcup')}
            />
          ) : null}
          {balanceVotes !== null ? (
            <GameTile
              emoji="⚖️"
              title="밸런스 게임"
              status={myVote ? '투표 완료 ✅' : '오늘의 한 판 👀'}
              accent="orange"
              onClick={() => setOpenGame('balance')}
            />
          ) : (
            <GameTilePlaceholder />
          )}
        </div>
      ) : null}

      {openGame === 'bingo' && bingo ? (
        <GameModal title="🎯 이달의 쪼물 빙고" onClose={() => setOpenGame(null)}>
          <BingoSection board={bingo} />
        </GameModal>
      ) : null}

      {openGame === 'worldcup' && contenders ? (
        <WorldCupModal
          initial={contenders}
          year={todayKey.slice(0, 4)}
          myName={myPid ? resolveName(myPid) : ''}
          myPid={myPid}
          onClose={() => setOpenGame(null)}
        />
      ) : null}

      {openGame === 'balance' && balanceVotes !== null ? (
        <GameModal title="⚖️ 오늘의 밸런스 게임" onClose={() => setOpenGame(null)}>
          <BalanceSection
            question={balanceQuestion}
            votes={balanceVotes}
            myId={myPid}
            onVote={isValidParticipantId(myPid) ? handleBalanceVote : undefined}
            resolveName={resolveName}
            getProfile={getProfileByEmpNo}
          />
        </GameModal>
      ) : null}

      {canWrite ? (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <AutoGrowTextarea
            value={draft}
            onChange={setDraft}
            minRows={3}
            placeholder="아무거나 적어봐요. 링크, 아이디어, 잡담, 뭐든..."
          />
          <div className="mt-3 flex items-center justify-end">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="h-9 px-4 text-xs font-medium rounded-full bg-ink-900 text-white hover:bg-pretzel disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      ) : null}

      {loading && memos.length === 0 ? (
        <div className="text-xs text-ink-400">불러오는 중...</div>
      ) : memos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-pretzel/30 bg-white/50 py-10 px-6 text-center">
          <p className="text-xs text-ink-400">아직 아무것도 없어요 📝</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {memos.map((memo) => {
            const isMine = !!myPid && memo.authorId === myPid;
            const name = resolveName(memo.authorId);
            return (
              <li
                key={memo.id}
                className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-pretzel/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    profile={getProfileByEmpNo(memo.authorId)}
                    size="sm"
                    fallbackText={name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink-700">{name}</span>
                      <span className="text-[11px] text-ink-400">
                        {formatMemoTime(memo.createdAt, memo.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-800 whitespace-pre-wrap break-words">
                      {memo.content}
                    </p>
                  </div>
                  {isMine ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditing(memo)}
                        className="text-ink-300 hover:text-ink-900 p-1.5 rounded hover:bg-ink-50"
                        aria-label="수정"
                        title="수정"
                      >
                        <LuPencil className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(memo.id)}
                        className="text-ink-300 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                        aria-label="삭제"
                        title="삭제"
                      >
                        <LuTrash2 className="text-sm" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <EditMemoDialog
          memo={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (content) => {
            await updateMemo(editing.id, content);
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// 게임 코너 타일 — 누르면 해당 게임 팝업이 열림
const TILE_ACCENT = {
  lime: 'border-lime-200 hover:border-lime-400 bg-gradient-to-b from-lime-50/60 to-white',
  indigo: 'border-indigo-200 hover:border-indigo-400 bg-gradient-to-b from-indigo-50/60 to-white',
  orange: 'border-orange-200 hover:border-orange-400 bg-gradient-to-b from-orange-50/60 to-white',
} as const;

function GameTile({
  emoji,
  title,
  status,
  accent,
  disabled = false,
  onClick,
}: {
  emoji: string;
  title: string;
  status: string;
  accent: keyof typeof TILE_ACCENT;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-2 px-2 py-3 text-center shadow-card transition-all ${
        disabled
          ? 'border-ink-100 bg-ink-50/40 opacity-60 cursor-default'
          : `${TILE_ACCENT[accent]} hover:-translate-y-0.5 active:scale-[0.97]`
      }`}
    >
      <p className="text-2xl leading-none">{emoji}</p>
      <p className="mt-1.5 text-[11px] font-bold text-ink-900 break-keep">{title}</p>
      <p className="mt-0.5 text-[10px] text-ink-500 break-keep">{status}</p>
    </button>
  );
}

function GameTilePlaceholder() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink-100 bg-white/50 px-2 py-3 text-center">
      <p className="text-2xl leading-none opacity-30">🎮</p>
      <p className="mt-1.5 text-[10px] text-ink-300">불러오는 중...</p>
    </div>
  );
}

// 게임 상세 팝업 (하단 시트 → sm 이상 중앙)
function GameModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// 입력할수록 자동으로 늘어나는 textarea. minRows만큼은 항상 확보.
function AutoGrowTextarea({
  value,
  onChange,
  minRows = 2,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={minRows}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full px-3 py-2 rounded-md border border-ink-200 text-sm placeholder-ink-300 resize-none focus:outline-none focus:border-pretzel/50 overflow-hidden"
    />
  );
}

function formatMemoTime(createdAt: string, updatedAt: string): string {
  const base = updatedAt || createdAt;
  if (!base) return '';
  // SQLite datetime('now')은 UTC. 'YYYY-MM-DD HH:mm:ss' 형태.
  const iso = base.includes('T') ? base : base.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const edited = updatedAt && createdAt && updatedAt !== createdAt ? ' · 수정됨' : '';
  return format(d, 'M월 d일 (EEE) HH:mm', { locale: ko }) + edited;
}

function EditMemoDialog({
  memo,
  onClose,
  onSubmit,
}: {
  memo: Memo;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(memo.content);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = content.trim();
    if (!trimmed) {
      setErr('내용을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-ink-100 max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold">메모 수정</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 p-1 rounded"
            aria-label="닫기"
          >
            <LuX />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          <AutoGrowTextarea
            value={content}
            onChange={setContent}
            minRows={5}
            autoFocus
          />
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
            className="h-10 px-5 text-sm rounded-full bg-ink-900 text-white hover:bg-pretzel disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
