import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX, LuSend } from 'react-icons/lu';
import { GiPretzel } from 'react-icons/gi';
import {
  ensureReportsSchema,
  listCommentsForReports,
  listReportsForDate,
  upsertReportComment,
  type Report,
  type ReportComment,
} from '../lib/reports';
import { noticesForToday, type AnniversaryNotice } from '../lib/anniversaries';
import { getFortune, type Fortune } from '../lib/fortune';
import { ScoreStars } from '../pages/FortunePage';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from './Avatar';

// 하루의 소식 팝업: 접속(새로고침) 시 1회,
//  - 다른 사람이 쓴 오늘의 보고 (안 본 것만)
//  - 기념일 알림 (당일은 무조건, 그 외엔 설정한 며칠 전)
//  - 오늘의 내 운세 (생일 등록된 경우, 하루 1회)
// 본 항목은 localStorage에 기록해서 다시 안 띄움.

const SEEN_KEY = 'zzomul.daily.seen.v1';

function readSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function markSeen(keys: string[]): void {
  try {
    const seen = readSeen();
    const now = Date.now();
    for (const k of keys) seen[k] = now;
    // 오래된 키 정리 (최대 300개 유지)
    const entries = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 300);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // localStorage 실패는 무시 (팝업이 반복될 뿐)
  }
}

const reportKey = (r: Report) => `report-${r.id}-${r.updatedAt}`;

// 보고에 짧은 댓글 달기 (팝업/보고 페이지 공용).
// 사람당 댓글 1개 — 이미 쓴 댓글이 있으면 그 내용으로 프리필되고, 다시 보내면 수정됨.
export function CommentInput({
  onSubmit,
  initial = '',
}: {
  onSubmit: (text: string) => Promise<void>;
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  // 저장 후 목록이 갱신되면 내 댓글 내용으로 다시 동기화
  useEffect(() => {
    setText(initial);
  }, [initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } catch {
      // 실패 시 입력 내용은 유지
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-1.5 pl-7">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={initial ? '내 댓글 수정하기 ✏️' : '따뜻한 한마디 💬'}
        className="flex-1 min-w-0 h-8 px-2.5 rounded-full border border-ink-200 text-[11px] placeholder-ink-300 bg-ink-50/40 focus:bg-white"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full bg-ink-900 text-white hover:bg-pretzel disabled:opacity-40"
        aria-label="댓글 보내기"
      >
        <LuSend className="text-xs" />
      </button>
    </form>
  );
}

// 팝업이 열릴 때 팡~ 터지는 이모지 컨페티.
// 각 조각은 중앙에서 --dx/--dy 방향으로 날아가며 사라짐.
const CONFETTI = ['🎉', '✨', '🎊', '🥨', '⭐', '💛', '🎉', '✨', '🎊', '🥨', '⭐', '💛'];

function ConfettiBurst() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
      {CONFETTI.map((emoji, i) => {
        const angle = (i / CONFETTI.length) * Math.PI * 2;
        const dist = 110 + (i % 3) * 45; // 조각마다 거리 다르게
        return (
          <span
            key={i}
            className="absolute text-2xl animate-burst"
            style={
              {
                '--dx': `${Math.round(Math.cos(angle) * dist)}px`,
                '--dy': `${Math.round(Math.sin(angle) * dist)}px`,
                '--rot': `${i % 2 === 0 ? 200 : -160}deg`,
                animationDelay: `${(i % 4) * 70}ms`,
              } as React.CSSProperties
            }
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

export default function DailyPopup({ myId }: { myId: string }) {
  const { loading: profilesLoading } = useProfiles();
  const { resolveName, namesLoading } = useAppData();
  const { items: anniversaries, ready: annivReady } = useAnniversaries();
  const [fired, setFired] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [comments, setComments] = useState<Record<number, ReportComment[]>>({});
  const [notices, setNotices] = useState<AnniversaryNotice[]>([]);
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [fortuneKey, setFortuneKey] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (fired) return;
    // 내 사번 자동 감지(직원 목록/프로필 로딩)와 기념일 로딩이 끝날 때까지 대기 —
    // 내가 쓴 보고가 나한테 뜨는 걸 막고, 기념일 누락을 방지
    if (namesLoading || profilesLoading || !annivReady) return;
    const timer = setTimeout(() => {
      setFired(true);
      void check();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fired, namesLoading, profilesLoading, annivReady, myId]);

  async function check() {
    try {
      await ensureReportsSchema();
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayReports = await listReportsForDate(today);
      const seen = readSeen();
      const freshReports = todayReports.filter(
        (r) => r.authorId !== myId && !seen[reportKey(r)],
      );
      const freshNotices = noticesForToday(anniversaries, new Date(), resolveName).filter(
        (n) => !seen[n.key],
      );
      // 오늘의 내 운세: 생일이 등록돼 있으면 그 날 처음 진입할 때 1회만
      const myBirthday = myId
        ? anniversaries.find((a) => a.kind === 'birthday' && a.ownerId === myId)?.date ?? ''
        : '';
      const fKey = `fortune-${myId}-${today}`;
      const freshFortune = myBirthday && !seen[fKey] ? getFortune(myId, myBirthday, today) : null;
      if (freshReports.length > 0 || freshNotices.length > 0 || freshFortune) {
        setReports(freshReports);
        setComments(await listCommentsForReports(freshReports.map((r) => r.id)));
        setNotices(freshNotices);
        setFortune(freshFortune);
        setFortuneKey(freshFortune ? fKey : '');
        setOpen(true);
      }
    } catch {
      // 조회 실패 시 팝업만 조용히 건너뜀
    }
  }

  // 팝업에서 바로 댓글 달기 (사람당 1개 — 다시 보내면 수정)
  async function handleAddComment(reportId: number, content: string) {
    await upsertReportComment(reportId, myId, content);
    setComments(await listCommentsForReports(reports.map((r) => r.id)));
  }

  function close() {
    markSeen([
      ...reports.map(reportKey),
      ...notices.map((n) => n.key),
      ...(fortuneKey ? [fortuneKey] : []),
    ]);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <DailyPopupView
      reports={reports}
      notices={notices}
      comments={comments}
      fortune={fortune}
      myId={myId}
      onAddComment={myId ? handleAddComment : undefined}
      onClose={close}
    />
  );
}

// 팝업 렌더링만 담당 — DevInfo의 "미리보기"에서도 샘플 데이터로 재사용
export function DailyPopupView({
  reports,
  notices,
  comments = {},
  fortune = null,
  myId = '',
  onAddComment,
  onClose,
}: {
  reports: Report[];
  notices: AnniversaryNotice[];
  comments?: Record<number, ReportComment[]>;
  fortune?: Fortune | null;
  myId?: string;
  onAddComment?: (reportId: number, content: string) => Promise<void>;
  onClose: () => void;
}) {
  const { getProfileByEmpNo } = useProfiles();
  const { resolveName } = useAppData();
  const dayOf = notices.filter((n) => n.daysUntil === 0);
  const upcoming = notices.filter((n) => n.daysUntil > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4">
      {/* 팡~ 컨페티 (카드 뒤에서 사방으로 터짐) */}
      <ConfettiBurst />
      <div
        className="w-full max-w-sm rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 via-white to-white shadow-lg animate-pop overflow-hidden max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header className="relative px-5 pt-6 pb-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-ink-300 hover:text-ink-900 p-1 rounded-full hover:bg-ink-50"
            aria-label="닫기"
          >
            <LuX />
          </button>
          <GiPretzel className="mx-auto text-4xl text-pretzel animate-wiggle" />
          <h2 className="mt-2 text-base font-bold text-ink-900">
            {dayOf.length > 0 ? '🎉 오늘은 특별한 날! 🎉' : '💌 따끈따끈한 소식 도착!'}
          </h2>
          <p className="text-[11px] text-ink-400 mt-0.5">
            {format(new Date(), 'M월 d일 (EEE)', { locale: ko })}
          </p>
        </header>

        <div className="px-5 pb-4 space-y-4 overflow-y-auto">
          {/* 기념일 당일 — 크게 축하 */}
          {dayOf.length > 0 ? (
            <ul className="space-y-2">
              {dayOf.map((n) => (
                <li
                  key={n.key}
                  className="rounded-2xl border-2 border-pink-200 bg-gradient-to-r from-pink-50 to-amber-50 px-4 py-3 text-center"
                >
                  <p className="text-2xl leading-none">✨{n.emoji}✨</p>
                  <p className="mt-1.5 text-sm font-bold text-ink-900">{n.text}</p>
                  <p className="text-[11px] text-pink-500 font-medium mt-0.5">🥳 오늘이에요! 축하해 주세요 🥳</p>
                </li>
              ))}
            </ul>
          ) : null}

          {/* 오늘의 내 운세 (그 날 첫 진입 시 1회) */}
          {fortune ? (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">🔮 오늘의 내 운세</h3>
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/80 to-white px-4 py-3">
                <p className="text-center text-xs">
                  <ScoreStars score={fortune.score} />
                </p>
                <p className="mt-1 text-center text-sm font-bold text-ink-900">
                  {fortune.headline}
                </p>
                <p className="mt-1 text-[11px] text-ink-600 leading-relaxed text-center">
                  {fortune.overall}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-ink-700 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
                    ✅ {fortune.doToday}
                  </p>
                  <p className="text-[11px] text-ink-700 rounded-lg bg-rose-50 border border-rose-100 px-2.5 py-1.5">
                    ⚠️ {fortune.avoidToday}
                  </p>
                </div>
                <p className="mt-2 text-center text-[10px] text-ink-400">
                  🍀 {fortune.luckyItem} · 🎨 {fortune.luckyColor.name} — 친구들 운세는 운세 탭에서!
                </p>
              </div>
            </div>
          ) : null}

          {/* 다가오는 기념일 (D-n) */}
          {upcoming.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">🗓️ 다가오는 기념일</h3>
              <ul className="space-y-1.5">
                {upcoming.map((n) => (
                  <li
                    key={n.key}
                    className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2"
                  >
                    <span className="text-lg">{n.emoji}</span>
                    <span className="text-xs text-ink-700 font-medium flex-1 min-w-0 truncate">{n.text}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 shrink-0">
                      D-{n.daysUntil}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 오늘의 보고 */}
          {reports.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">📢 오늘의 보고</h3>
              <ul className="space-y-1.5">
                {reports.map((r) => {
                  const name = resolveName(r.authorId);
                  const cmts = comments[r.id] ?? [];
                  return (
                    <li key={r.id} className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <Avatar profile={getProfileByEmpNo(r.authorId)} size="xs" fallbackText={name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-ink-700">{name}</p>
                          <p className="text-xs text-ink-600 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                        </div>
                      </div>
                      {cmts.length > 0 ? (
                        <ul className="mt-2 space-y-1 pl-7">
                          {cmts.map((c) => (
                            <li key={c.id} className="flex items-start gap-1.5 text-[11px]">
                              <span className="font-semibold text-ink-600 shrink-0">
                                {resolveName(c.authorId)}
                              </span>
                              <span className="text-ink-500 whitespace-pre-wrap min-w-0">{c.content}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {/* 내 보고에는 댓글 불가 — 팝업엔 남의 보고만 오지만 안전장치 */}
                      {onAddComment && r.authorId !== myId ? (
                        <CommentInput
                          initial={cmts.find((c) => c.authorId === myId)?.content ?? ''}
                          onSubmit={(text) => onAddComment(r.id, text)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="px-5 pb-5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-full bg-ink-900 text-white text-sm font-semibold hover:bg-ink-700 active:scale-[0.98] transition-transform"
          >
            확인했어요! 👍
          </button>
        </footer>
      </div>
    </div>
  );
}
