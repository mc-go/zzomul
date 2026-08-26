import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LuX, LuSend, LuArrowRight, LuBell } from 'react-icons/lu';
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
import {
  ensureBalanceSchema,
  getBalanceQuestion,
  listBalanceVotes,
  upsertBalanceVote,
  type BalanceChoice,
  type BalanceQuestion,
  type BalanceVote,
} from '../lib/balance';
import { isValidParticipantId } from '../lib/members';
import { DB_WRITE_EVENT } from '../lib/db';
import { ensureSchema as ensureLunchesSchema, listLunches, type Lunch } from '../lib/lunches';
import { ensureReviewsSchema, listAllReviews } from '../lib/reviews';
import { ensureSettingsSchema, getSetting, mbtiKey } from '../lib/settings';
import {
  getMonthlyRecap,
  getYearlyRecap,
  inRecapWindow,
  isYearEndSeason,
  type MonthlyRecap,
  type YearlyRecap,
} from '../lib/monthly-recap';
import { ScoreStars } from '../pages/FortunePage';
import { useProfiles } from '../contexts/ProfilesContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAnniversaries } from '../contexts/AnniversariesContext';
import Avatar from './Avatar';

// 하루의 소식 팝업:
//  - 다른 사람이 쓴 오늘의 보고 (안 본 것만 — 단, 내 댓글이 없으면 쿨다운마다 다시 알림)
//  - 기념일 알림 (당일은 무조건, 그 외엔 설정한 며칠 전)
//  - 오늘의 내 운세 (생일 등록된 경우, 하루 1회)
//  - 오늘의 밸런스 게임 (내가 투표할 때까지 쿨다운마다 다시 알림)
//  - 월간 결산 (매월 1~5일 1회 — 지난달 요약 + 새 달 추천/응원, src/lib/monthly-recap.ts)
//  - 연말 리캡·맛집 월드컵 알림 (연말 시즌 = 12월 마지막 주 한 주 전부터, 각 1회)
//  - 먹기록 업데이트 알림 (날짜 지난 위시 기록 — 점심은 당일 12시, 저녁은 자정 지나면.
//    다녀왔어요 처리할 때까지 쿨다운마다 다시 알림, 멤버만)
//  - 내 평 리마인드 (최근 7일 내 다녀온 기록 중 내가 참여했는데 평이 없는 것, 멤버만)
// 확인 시점: 접속(새로고침) 직후 1회 + 이후엔 탭 이동·창 복귀·DB 쓰기(저장/투표 등) 때마다
// 다시 확인 (단, 팝업이 떠 있거나 직전 확인에서 얼마 안 지났으면 건너뜀).
// 표시 방식: 하루 최초 1회는 팝업이 자동으로 뜨고, 그 뒤로는 헤더의 종 아이콘에
// 탭 개수 뱃지만 표시(알림 있으면 종이 흔들림) — 종을 누르면 같은 팝업이 뜬다.
// 본 항목은 localStorage에 기록 — 완료한 항목(운세·기념일·댓글 단 보고·투표한 밸런스)은
// 다시 안 뜨고, 미완료 항목은 기록 시각이 쿨다운을 지나면 리마인드로 다시 뜬다.
// 항목이 2종류 이상이면 상단 탭으로 구분해서 보여줌.

const SEEN_KEY = 'zzomul.daily.seen.v1';
// 오늘 자동 팝업을 이미 띄웠는지 (yyyy-MM-dd 저장)
const AUTO_SHOWN_KEY = 'zzomul.daily.autoshown.v1';

// 미완료 항목(댓글 안 단 보고·투표 안 한 밸런스)을 다시 띄우기까지의 간격
const REMIND_COOLDOWN_MS = 30 * 60 * 1000;
// 재확인 최소 간격 — 탭 이동/저장이 잦아도 DB 조회를 이보다 자주 하지 않음
const MIN_RECHECK_MS = 10 * 1000;

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
const recordKey = (l: Lunch) => `record-${l.id}-${l.plannedDate}`;
const reviewKey = (l: Lunch) => `review-${l.id}`;

// 내 평 리마인드 대상 기간 — 너무 오래된 기록까지 조르지 않게 최근 7일만
const REVIEW_REMIND_DAYS = 7;

// 쪼물런치는 12시에 끝나니 당일 정오부터, 디너는 밤에 끝나니 자정(다음날)부터 알림
const LUNCH_DONE_HOUR = 12;

// 날짜가 정해진 위시 기록 중 그 시간이 지나 "다녀왔어요" 업데이트가 필요한 것들
function overduePlannedLunches(lunches: Lunch[], myId: string, now: Date): Lunch[] {
  const todayStr = format(now, 'yyyy-MM-dd');
  return lunches.filter((l) => {
    if (l.status !== 'wishlist' || !l.plannedDate) return false;
    // 참여자가 지정돼 있으면 내가 낀 기록만 (비어 있으면 전원으로 간주)
    if (l.participants.length > 0 && !(l.participants as readonly string[]).includes(myId)) {
      return false;
    }
    if (l.plannedDate < todayStr) return true;
    return l.plannedDate === todayStr && l.meal === 'lunch' && now.getHours() >= LUNCH_DONE_HOUR;
  });
}

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
  const [balance, setBalance] = useState<BalanceQuestion | null>(null);
  const [balanceVotes, setBalanceVotes] = useState<BalanceVote[]>([]);
  const [balanceKey, setBalanceKey] = useState('');
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);
  const [recapKey, setRecapKey] = useState('');
  const [yearly, setYearly] = useState<YearlyRecap | null>(null);
  const [yearlyKey, setYearlyKey] = useState('');
  const [worldcup, setWorldcup] = useState(false);
  const [worldcupKey, setWorldcupKey] = useState('');
  const [pendingRecords, setPendingRecords] = useState<Lunch[]>([]);
  const [reviewPending, setReviewPending] = useState<Lunch[]>([]);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // 이벤트 리스너(1회 등록)에서 항상 최신 상태/클로저를 쓰기 위한 ref들
  const openRef = useRef(open);
  openRef.current = open;
  const firedRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    if (fired) return;
    // 내 사번 자동 감지(직원 목록/프로필 로딩)와 기념일 로딩이 끝날 때까지 대기 —
    // 내가 쓴 보고가 나한테 뜨는 걸 막고, 기념일 누락을 방지
    if (namesLoading || profilesLoading || !annivReady) return;
    const timer = setTimeout(() => {
      setFired(true);
      firedRef.current = true;
      lastCheckAtRef.current = Date.now();
      void check();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fired, namesLoading, profilesLoading, annivReady, myId]);

  // 최초 확인 이후의 재확인 — 팝업이 떠 있지 않고, 직전 확인에서 충분히 지났을 때만
  function recheck() {
    if (!firedRef.current || openRef.current) return;
    if (Date.now() - lastCheckAtRef.current < MIN_RECHECK_MS) return;
    lastCheckAtRef.current = Date.now();
    void check();
  }
  const recheckRef = useRef(recheck);
  recheckRef.current = recheck;

  // 탭(라우트) 이동 시 재확인
  useEffect(() => {
    recheckRef.current();
  }, [location.pathname]);

  // 창 복귀(포커스/visible)·DB 쓰기(보고 저장, 댓글, 투표 등) 후 재확인
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      recheckRef.current();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener(DB_WRITE_EVENT, onWake);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener(DB_WRITE_EVENT, onWake);
    };
  }, []);

  async function check() {
    if (openRef.current) return; // 이미 떠 있으면 내용을 갈아치우지 않음
    try {
      await ensureReportsSchema();
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayReports = await listReportsForDate(today);
      const seen = readSeen();
      const now = Date.now();
      // 미완료 항목은 마지막으로 본 지 쿨다운이 지나면 다시 알림 대상
      const remindable = (key: string) => !seen[key] || now - seen[key] > REMIND_COOLDOWN_MS;
      // 오늘의 보고: 남이 쓴 것 중 — 내 댓글을 이미 단 보고는 아예 안 띄우고,
      // 안 단 보고는 까먹지 않도록 쿨다운마다 다시
      const othersReports = todayReports.filter((r) => r.authorId !== myId);
      const allComments = await listCommentsForReports(othersReports.map((r) => r.id));
      const freshReports = othersReports.filter((r) => {
        const commented = !!myId && (allComments[r.id] ?? []).some((c) => c.authorId === myId);
        if (commented) return false;
        // 댓글을 달 수 없는 게스트(myId 없음)는 리마인드 없이 처음 볼 때 1회만
        return myId ? remindable(reportKey(r)) : !seen[reportKey(r)];
      });
      const freshNotices = noticesForToday(anniversaries, new Date(), resolveName).filter(
        (n) => !seen[n.key],
      );
      // 오늘의 내 운세: 생일이 등록돼 있으면 그 날 처음 진입할 때 1회만
      const myBirthday = myId
        ? anniversaries.find((a) => a.kind === 'birthday' && a.ownerId === myId)?.date ?? ''
        : '';
      const fKey = `fortune-${myId}-${today}`;
      let freshFortune: Fortune | null = null;
      if (myBirthday && !seen[fKey]) {
        // MBTI가 시드에 들어가므로 운세 탭과 같은 값을 넘겨야 팝업과 탭의 운세가 일치함
        const myMbti = await ensureSettingsSchema()
          .then(() => getSetting(mbtiKey(myId)))
          .catch(() => null);
        freshFortune = getFortune(myId, myBirthday, today, myMbti ?? '');
      }
      // 오늘의 밸런스 게임: 투표 가능한 멤버에게만 — 투표할 때까지 쿨다운마다 다시 알림
      const bKey = `balance-${myId}-${today}`;
      let freshBalance: BalanceQuestion | null = null;
      let freshVotes: BalanceVote[] = [];
      const isMember = isValidParticipantId(myId);
      if (isMember) {
        await ensureBalanceSchema();
        const votes = await listBalanceVotes(today);
        const voted = votes.some((v) => v.voterId === myId);
        if (!voted && remindable(bKey)) {
          freshBalance = getBalanceQuestion(today);
          freshVotes = votes;
        }
      }
      // 월간 결산(매월 1~5일 1회) + 먹기록 업데이트 알림 — 먹기록 조회가 필요할 때만
      const rKey = `recap-${today.slice(0, 7)}`;
      const needRecap = inRecapWindow(new Date()) && !seen[rKey];
      // 연말 시즌: 연간 리캡 + 맛집 월드컵 알림 (각각 시즌 중 1회, 멤버만)
      const year = today.slice(0, 4);
      const yKey = `recap-year-${year}`;
      const wKey = `worldcup-${year}`;
      const yearEnd = isYearEndSeason(new Date());
      let freshYearly: YearlyRecap | null = null;
      const freshWorldcup = yearEnd && isMember && !seen[wKey];
      let freshRecap: MonthlyRecap | null = null;
      let freshPending: Lunch[] = [];
      let freshReviewPending: Lunch[] = [];
      if (needRecap || isMember) {
        await ensureLunchesSchema();
        const allLunches = await listLunches();
        if (needRecap) freshRecap = getMonthlyRecap(allLunches, new Date());
        if (isMember) {
          freshPending = overduePlannedLunches(allLunches, myId, new Date()).filter((l) =>
            remindable(recordKey(l)),
          );
          // 내 평 리마인드: 최근 N일 내 다녀온 기록 중 내가 참여했는데 평이 없는 것
          await ensureReviewsSchema();
          const allReviews = await listAllReviews();
          const cutoff = format(subDays(new Date(), REVIEW_REMIND_DAYS), 'yyyy-MM-dd');
          freshReviewPending = allLunches.filter(
            (l) =>
              l.status === 'done' &&
              l.date >= cutoff &&
              l.date <= today &&
              (l.participants.length === 0 ||
                (l.participants as readonly string[]).includes(myId)) &&
              !(allReviews[l.id] ?? []).some((r) => r.reviewerId === myId) &&
              remindable(reviewKey(l)),
          );
          if (yearEnd && !seen[yKey]) {
            freshYearly = getYearlyRecap(allLunches, allReviews, new Date());
          }
        }
      }
      // 상태는 항상 갱신 — 종 아이콘 뱃지가 최신 소식 개수를 보여줄 수 있게
      setReports(freshReports);
      setComments(allComments);
      setNotices(freshNotices);
      setFortune(freshFortune);
      setFortuneKey(freshFortune ? fKey : '');
      setBalance(freshBalance);
      setBalanceVotes(freshVotes);
      setBalanceKey(freshBalance ? bKey : '');
      setRecap(freshRecap);
      setRecapKey(freshRecap ? rKey : '');
      setPendingRecords(freshPending);
      setReviewPending(freshReviewPending);
      setYearly(freshYearly);
      setYearlyKey(freshYearly ? yKey : '');
      setWorldcup(freshWorldcup);
      setWorldcupKey(freshWorldcup ? wKey : '');
      const hasAny =
        freshReports.length > 0 ||
        freshNotices.length > 0 ||
        !!freshFortune ||
        !!freshBalance ||
        !!freshRecap ||
        !!freshYearly ||
        freshWorldcup ||
        freshPending.length > 0 ||
        freshReviewPending.length > 0;
      // 하루 최초 1회만 자동으로 팝업 — 이후엔 종 아이콘 뱃지로만 알림
      if (hasAny) {
        let autoShown = '';
        try {
          autoShown = localStorage.getItem(AUTO_SHOWN_KEY) ?? '';
        } catch {
          // localStorage 실패 시엔 그냥 자동으로 띄움
        }
        if (autoShown !== today) {
          try {
            localStorage.setItem(AUTO_SHOWN_KEY, today);
          } catch {
            // ignore
          }
          setOpen(true);
        }
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

  // 밸런스 투표 (1인 1표 — 다시 누르면 변경)
  async function handleBalanceVote(choice: BalanceChoice) {
    if (!isValidParticipantId(myId)) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    await upsertBalanceVote(today, myId, choice);
    setBalanceVotes(await listBalanceVotes(today));
  }

  function close() {
    markSeen([
      ...reports.map(reportKey),
      ...notices.map((n) => n.key),
      ...(fortuneKey ? [fortuneKey] : []),
      ...(balanceKey ? [balanceKey] : []),
      ...(recapKey ? [recapKey] : []),
      ...(yearlyKey ? [yearlyKey] : []),
      ...(worldcupKey ? [worldcupKey] : []),
      ...pendingRecords.map(recordKey),
      ...reviewPending.map(reviewKey),
    ]);
    setOpen(false);
    // 방금 본 것들은 전부 확인/스누즈 처리됐으니 뱃지도 비움 (리마인드는 다음 확인 때 다시)
    setReports([]);
    setNotices([]);
    setFortune(null);
    setFortuneKey('');
    setBalance(null);
    setBalanceVotes([]);
    setBalanceKey('');
    setRecap(null);
    setRecapKey('');
    setYearly(null);
    setYearlyKey('');
    setWorldcup(false);
    setWorldcupKey('');
    setPendingRecords([]);
    setReviewPending([]);
  }

  // 종 뱃지 숫자 = 소식이 있는 탭 개수
  const tabCount =
    (recap || yearly ? 1 : 0) +
    (notices.length > 0 ? 1 : 0) +
    (reports.length > 0 ? 1 : 0) +
    (pendingRecords.length > 0 || reviewPending.length > 0 ? 1 : 0) +
    (fortune ? 1 : 0) +
    (balance || worldcup ? 1 : 0);

  return (
    <>
      {/* 헤더용 종 아이콘 — 소식이 있으면 흔들리고 탭 개수가 뱃지로 보임 */}
      <button
        type="button"
        onClick={() => tabCount > 0 && setOpen(true)}
        className={`relative inline-flex items-center text-xs px-2 py-1.5 rounded-md hover:bg-ink-50 ${
          tabCount > 0 ? 'text-pretzel hover:text-pretzel-dark' : 'text-ink-300 cursor-default'
        }`}
        title={tabCount > 0 ? `오늘의 소식 ${tabCount}개` : '새 소식이 없어요'}
        aria-label="오늘의 소식"
      >
        <LuBell className={`text-sm ${tabCount > 0 ? 'animate-wiggle' : ''}`} />
        {tabCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {tabCount}
          </span>
        ) : null}
      </button>

      {/* 팝업은 body 포털로 — 종이 사는 헤더의 backdrop-blur가
          fixed 기준점을 가로채서 팝업이 헤더 쪽에 뜨는 걸 방지 */}
      {open
        ? createPortal(
            <DailyPopupView
              reports={reports}
              notices={notices}
              comments={comments}
              fortune={fortune}
              balance={balance}
              balanceVotes={balanceVotes}
              onBalanceVote={handleBalanceVote}
              recap={recap}
              yearly={yearly}
              worldcup={worldcup}
              pendingRecords={pendingRecords}
              reviewPending={reviewPending}
              myId={myId}
              onAddComment={myId ? handleAddComment : undefined}
              onClose={close}
            />,
            document.body,
          )
        : null}
    </>
  );
}

// 팝업 탭 종류 — 항목이 2종류 이상일 때만 탭 바가 보임
type PopupTab = 'recap' | 'anniv' | 'fortune' | 'record' | 'report' | 'balance';

const TAB_LABEL: Record<PopupTab, string> = {
  recap: '📊 결산',
  anniv: '🎉 기념일',
  fortune: '🔮 운세',
  record: '📝 기록',
  report: '📢 보고',
  balance: '🎮 게임',
};

// 팝업 렌더링만 담당 — DevInfo의 "미리보기"에서도 샘플 데이터로 재사용
export function DailyPopupView({
  reports,
  notices,
  comments = {},
  fortune = null,
  balance = null,
  balanceVotes = [],
  onBalanceVote,
  recap = null,
  yearly = null,
  worldcup = false,
  pendingRecords = [],
  reviewPending = [],
  myId = '',
  onAddComment,
  onClose,
}: {
  reports: Report[];
  notices: AnniversaryNotice[];
  comments?: Record<number, ReportComment[]>;
  fortune?: Fortune | null;
  balance?: BalanceQuestion | null;
  balanceVotes?: BalanceVote[];
  onBalanceVote?: (choice: BalanceChoice) => Promise<void>;
  recap?: MonthlyRecap | null;
  yearly?: YearlyRecap | null;
  worldcup?: boolean;
  pendingRecords?: Lunch[];
  reviewPending?: Lunch[];
  myId?: string;
  onAddComment?: (reportId: number, content: string) => Promise<void>;
  onClose: () => void;
}) {
  const { getProfileByEmpNo } = useProfiles();
  const { resolveName } = useAppData();
  const dayOf = notices.filter((n) => n.daysUntil === 0);
  const upcoming = notices.filter((n) => n.daysUntil > 0);

  // 내용이 있는 탭만 순서대로 (결산 → 기념일 → 보고 → 기록 → 운세 → 게임)
  const tabs: PopupTab[] = [
    ...(recap || yearly ? (['recap'] as const) : []),
    ...(notices.length > 0 ? (['anniv'] as const) : []),
    ...(reports.length > 0 ? (['report'] as const) : []),
    ...(pendingRecords.length > 0 || reviewPending.length > 0 ? (['record'] as const) : []),
    ...(fortune ? (['fortune'] as const) : []),
    ...(balance || worldcup ? (['balance'] as const) : []),
  ];
  const [active, setActive] = useState<PopupTab>(tabs[0] ?? 'report');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4">
      {/* 팡~ 컨페티 (카드 뒤에서 사방으로 터짐) */}
      <ConfettiBurst />
      <div
        className="w-full max-w-sm rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 via-white to-white shadow-lg animate-pop overflow-hidden max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header className="relative px-5 pt-6 pb-3 text-center">
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

        {/* 소식 종류가 2개 이상이면 탭으로 구분 (많으면 줄바꿈) */}
        {tabs.length >= 2 ? (
          <nav className="flex items-center justify-center gap-1 flex-wrap px-5 pb-3">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActive(t)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
                  active === t
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-500 border border-ink-200 hover:border-ink-400'
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="px-5 pb-4 space-y-4 overflow-y-auto">
          {/* 결산: 연말 리캡(시즌 1회) + 월간 결산(매월 1~5일 1회) */}
          {active === 'recap' && yearly ? <YearlyRecapSection yearly={yearly} /> : null}
          {active === 'recap' && recap ? <RecapSection recap={recap} /> : null}

          {/* 먹기록 업데이트 알림 — 날짜 지난 위시 기록 + 내 평 안 남긴 기록 */}
          {active === 'record' && (pendingRecords.length > 0 || reviewPending.length > 0) ? (
            <RecordSection records={pendingRecords} reviewPending={reviewPending} onClose={onClose} />
          ) : null}

          {/* 기념일 당일 — 크게 축하 */}
          {active === 'anniv' && dayOf.length > 0 ? (
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
          {active === 'fortune' && fortune ? (
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
          {active === 'anniv' && upcoming.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">🗓️ 다가오는 기념일</h3>
              <ul className="space-y-1.5">
                {upcoming.map((n) => (
                  <li
                    key={n.key}
                    className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2"
                  >
                    <span className="text-lg">{n.emoji}</span>
                    <span className="text-xs text-ink-700 font-medium flex-1 min-w-0 break-keep">{n.text}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 shrink-0">
                      D-{n.daysUntil}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 오늘의 보고 */}
          {active === 'report' && reports.length > 0 ? (
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

          {/* 게임: 맛집 월드컵 개막 알림(연말) + 오늘의 밸런스 게임 */}
          {active === 'balance' && worldcup ? (
            <Link
              to="/memo"
              onClick={onClose}
              className="block rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 text-center hover:border-indigo-400 transition-colors"
            >
              <p className="text-2xl leading-none">🏟️</p>
              <p className="mt-1.5 text-sm font-bold text-ink-900">맛집 월드컵 개막!</p>
              <p className="mt-0.5 text-[11px] text-ink-500 break-keep">
                올해 다녀온 가게들로 우리 팀 챔피언을 뽑아요 — 아무거나 탭에서 도전 →
              </p>
            </Link>
          ) : null}
          {active === 'balance' && balance ? (
            <BalanceSection
              question={balance}
              votes={balanceVotes}
              myId={myId}
              onVote={onBalanceVote}
              resolveName={resolveName}
              getProfile={getProfileByEmpNo}
            />
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

// 연말 리캡 — 올해 총결산 카드 (연말 시즌 1회)
function YearlyRecapSection({ yearly }: { yearly: YearlyRecap }) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white px-4 py-4 text-center">
      <p className="text-2xl leading-none">🎁</p>
      <p className="mt-1.5 text-sm font-bold text-ink-900">{yearly.year}년 쪼물랭 총결산</p>
      <p className="mt-2 text-xs text-ink-700 break-keep leading-relaxed">
        올해 우리는 <b>{yearly.places}곳</b>에서 <b>{yearly.total}번</b> 함께 먹었어요
        <br />
        <span className="text-[11px] text-ink-500">
          🍜 쪼물런치 {yearly.lunchCount} · 🌙 쪼물디너 {yearly.dinnerCount} · ✍️ 리뷰{' '}
          {yearly.reviewCount}개
        </span>
      </p>
      {yearly.topPlace ? (
        <p className="mt-2 text-[11px] text-ink-600 break-keep">
          올해의 최다 방문 🏆 <b className="text-ink-900">{yearly.topPlace.name}</b> (
          {yearly.topPlace.count}번)
        </p>
      ) : null}
      <p className="mt-2.5 text-[11px] text-pretzel font-semibold break-keep">
        올 한 해도 맛있게 잘 살았어요. 내년에도 맛있는 일만 가득하길! 🥨
      </p>
    </div>
  );
}

// 월간 결산 — 지난달 요약 + 새 달 추천 + 응원 한마디 (매월 1~5일 1회)
function RecapSection({ recap }: { recap: MonthlyRecap }) {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/80 to-white px-4 py-3">
        <p className="text-center text-sm font-bold text-ink-900">
          📊 {recap.monthLabel} 먹기록 결산
        </p>
        <p className="mt-1.5 text-center text-xs text-ink-700 break-keep">
          🍜 쪼물런치 <b>{recap.lunchCount}번</b> · 🌙 쪼물디너 <b>{recap.dinnerCount}번</b>
        </p>
        <p className="mt-0.5 text-center text-[11px] text-ink-500">
          일주일에 평균 <b className="text-ink-700">{recap.perWeek}번</b> 함께 먹었어요
        </p>
        {recap.places.length > 0 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {recap.places.map((p) => (
              <span
                key={p.name}
                className="rounded-full border border-sky-100 bg-white px-2 py-0.5 text-[10px] text-ink-600 break-keep"
              >
                {p.name}
                {p.count > 1 ? ` ×${p.count}` : ''}
              </span>
            ))}
            {recap.morePlaces > 0 ? (
              <span className="px-1 text-[10px] text-ink-400 self-center">
                외 {recap.morePlaces}곳
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {recap.recommendation ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white px-4 py-3 text-center">
          <p className="text-[11px] font-semibold text-emerald-700">
            🧭 {recap.newMonthLabel}엔 여기 어때요?
          </p>
          <p className="mt-1 text-sm font-bold text-ink-900 break-keep">
            {recap.recommendation.restaurant}
            {recap.recommendation.menu ? (
              <span className="ml-1 text-xs font-medium text-ink-500">
                {recap.recommendation.menu}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500 break-keep">{recap.recommendation.reason}</p>
        </div>
      ) : recap.wishlistEmpty ? (
        <p className="text-center text-[11px] text-ink-400 break-keep">
          가고 싶은 곳을 위시리스트에 담아두면 다음 결산 때 추천해 드려요 📌
        </p>
      ) : null}
      <p className="text-center text-xs text-pretzel font-semibold break-keep">🥨 {recap.cheer}</p>
    </div>
  );
}

// 먹기록 업데이트 알림 — 날짜가 지난 위시 기록의 "다녀왔어요" + 내 평 안 남긴 기록 재촉
function RecordSection({
  records,
  reviewPending = [],
  onClose,
}: {
  records: Lunch[];
  reviewPending?: Lunch[];
  onClose: () => void;
}) {
  return (
    <div>
      {records.length > 0 ? (
        <>
          <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">
            📝 다녀온 기록, 업데이트해 주세요!
          </h3>
          <ul className="space-y-1.5">
            {records.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-xl border border-lime-200 bg-lime-50/50 px-3 py-2"
              >
                <span className="text-lg shrink-0">
                  {l.meal === 'dinner' ? '🌙' : l.delivery ? '🛵' : '🍜'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-800 break-keep">{l.restaurant}</p>
                  <p className="text-[10px] text-ink-500">
                    {l.plannedDate
                      ? format(new Date(`${l.plannedDate}T00:00:00`), 'M/d (EEE)', { locale: ko })
                      : ''}{' '}
                    {l.meal === 'dinner' ? '저녁' : '점심'} 약속이었어요
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {reviewPending.length > 0 ? (
        <div className={records.length > 0 ? 'mt-3' : ''}>
          <h3 className="text-[11px] font-semibold text-ink-500 mb-1.5">
            ⭐ 내 평이 아직 없는 기록이에요
          </h3>
          <ul className="space-y-1.5">
            {reviewPending.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2"
              >
                <span className="text-lg shrink-0">
                  {l.meal === 'dinner' ? '🌙' : l.delivery ? '🛵' : '🍜'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-800 break-keep">{l.restaurant}</p>
                  <p className="text-[10px] text-ink-500">
                    {format(new Date(`${l.date}T00:00:00`), 'M/d (EEE)', { locale: ko })} 다녀옴 —
                    별점과 한마디 부탁해요 ✍️
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        to="/lunch"
        onClick={onClose}
        className="mt-2 flex items-center justify-center gap-1 h-9 rounded-full border border-pretzel/40 bg-pretzel/5 text-xs font-semibold text-pretzel hover:bg-pretzel/10"
      >
        먹기록 탭에서 업데이트하기
        <LuArrowRight className="text-sm" />
      </Link>
    </div>
  );
}

// 오늘의 밸런스 게임 — 내가 투표하기 전엔 결과를 가려서 눈치보기 방지.
// 투표 후엔 양쪽 득표와 누가 뭘 골랐는지 공개. 다시 누르면 변경.
// 팝업과 아무거나 탭(MemoPage)에서 공용.
export function BalanceSection({
  question,
  votes,
  myId,
  onVote,
  resolveName,
  getProfile,
}: {
  question: BalanceQuestion;
  votes: BalanceVote[];
  myId: string;
  onVote?: (choice: BalanceChoice) => Promise<void>;
  resolveName: (id: string) => string;
  getProfile: (id: string) => import('../lib/profiles').Profile | null;
}) {
  const [busy, setBusy] = useState(false);
  const myVote = votes.find((v) => v.voterId === myId)?.choice ?? null;

  async function vote(choice: BalanceChoice) {
    if (!onVote || busy || myVote === choice) return;
    setBusy(true);
    try {
      await onVote(choice);
    } finally {
      setBusy(false);
    }
  }

  const side = (choice: BalanceChoice) => {
    const label = choice === 'a' ? question.a : question.b;
    const voters = votes.filter((v) => v.choice === choice);
    const picked = myVote === choice;
    return (
      <button
        type="button"
        disabled={busy || !onVote}
        onClick={() => vote(choice)}
        className={`flex-1 min-w-0 rounded-2xl border-2 px-3 py-3 text-center transition-all active:scale-[0.97] ${
          picked
            ? 'border-pretzel bg-pretzel/10 shadow-card'
            : myVote
              ? 'border-ink-100 bg-white opacity-70 hover:opacity-100'
              : 'border-ink-200 bg-white hover:border-pretzel/50 hover:-translate-y-0.5'
        }`}
      >
        <p className="text-sm font-bold text-ink-900 whitespace-pre-wrap break-keep">{label}</p>
        {/* 결과는 내가 투표한 뒤에만 공개 */}
        {myVote ? (
          <div className="mt-2">
            <p className={`text-lg font-bold ${picked ? 'text-pretzel' : 'text-ink-400'}`}>
              {voters.length}표
            </p>
            {voters.length > 0 ? (
              <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                {voters.map((v) => (
                  <span
                    key={v.voterId}
                    className="inline-flex items-center gap-1 text-[10px] text-ink-600"
                    title={resolveName(v.voterId)}
                  >
                    <Avatar
                      profile={getProfile(v.voterId)}
                      size="xs"
                      fallbackText={resolveName(v.voterId)}
                    />
                    {resolveName(v.voterId)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div>
      <div className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50/80 to-white px-4 py-3">
        <p className="text-center text-sm font-bold text-ink-900">{question.topic}</p>
        <div className="mt-3 flex items-stretch gap-2">
          {side('a')}
          <span className="self-center shrink-0 text-[10px] font-bold text-orange-400">VS</span>
          {side('b')}
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-400">
          {myVote
            ? '다른 걸 누르면 투표를 바꿀 수 있어요'
            : '투표하면 친구들의 선택이 보여요 👀'}
        </p>
      </div>
    </div>
  );
}
