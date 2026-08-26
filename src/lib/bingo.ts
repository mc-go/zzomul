import type { Lunch } from './lunches';
import { averageRating, type LunchReview } from './reviews';
import type { BalanceVote } from './balance';
import { normalizeRestaurant } from './lunch-stats';
import { hashSeed, mulberry32 } from './fortune';
import { MEMBER_EMPNOS, isTrackedMember } from './members';

// 이달의 쪼물 빙고 — 3×3 미션판, 전부 기존 데이터로 자동 체크 (저장 없음).
// 미션 풀에서 월 시드로 9개를 결정적으로 뽑아 배치하므로 같은 달엔 누가 봐도 같은 판.
// 미션 추가는 자유, 삭제/이름(key) 변경은 지난 달 판이 바뀌니 주의.

export type BingoCell = {
  key: string;
  emoji: string;
  label: string;
  hint: string;
  done: boolean;
};

export type BingoBoard = {
  month: string; // yyyy-MM
  cells: BingoCell[]; // 9칸 (행 우선)
  doneCount: number;
  lines: number; // 완성된 줄 수 (가로3 + 세로3 + 대각2 중)
  full: boolean;
};

type Ctx = {
  monthDone: Lunch[]; // 이달 다녀온 기록
  allDone: Lunch[]; // 전체 다녀온 기록 (단골/첫 방문 판정용)
  reviews: Record<number, LunchReview[]>;
  votes: BalanceVote[]; // 이달 밸런스 투표
};

const MISSIONS: { key: string; emoji: string; label: string; hint: string; check: (c: Ctx) => boolean }[] = [
  {
    key: 'lunch4',
    emoji: '🍜',
    label: '쪼물런치 4번',
    hint: '이달에 쪼물런치 4번 다녀오기',
    check: (c) => c.monthDone.filter((l) => l.meal === 'lunch').length >= 4,
  },
  {
    key: 'dinner1',
    emoji: '🌙',
    label: '쪼물디너 1번',
    hint: '이달에 쪼물디너 1번 다녀오기',
    check: (c) => c.monthDone.some((l) => l.meal === 'dinner'),
  },
  {
    key: 'delivery1',
    emoji: '🛵',
    label: '배달 1번',
    hint: '이달에 배달로 1번 먹기',
    check: (c) => c.monthDone.some((l) => l.delivery),
  },
  {
    key: 'newplace',
    emoji: '🧭',
    label: '새 가게 개척',
    hint: '처음 가보는 가게 방문하기',
    check: (c) =>
      c.monthDone.some((l) => {
        const key = normalizeRestaurant(l.restaurant);
        if (!key) return false;
        return !c.allDone.some(
          (o) => o.date < l.date && normalizeRestaurant(o.restaurant) === key,
        );
      }),
  },
  {
    key: 'regular3',
    emoji: '🔥',
    label: '단골 도장',
    hint: '같은 가게 누적 3회차 이상 방문하기',
    check: (c) =>
      c.monthDone.some((l) => {
        const key = normalizeRestaurant(l.restaurant);
        if (!key) return false;
        return (
          c.allDone.filter((o) => o.date <= l.date && normalizeRestaurant(o.restaurant) === key)
            .length >= 3
        );
      }),
  },
  {
    key: 'allreview',
    emoji: '📝',
    label: '전원 리뷰',
    hint: '한 기록에 참여 멤버 모두 별점 남기기',
    check: (c) =>
      c.monthDone.some((l) => {
        const rs = c.reviews[l.id] ?? [];
        const members = l.participants.filter(isTrackedMember);
        const needed = members.length > 0 ? members : [...MEMBER_EMPNOS];
        return needed.every((emp) => rs.some((r) => r.reviewerId === emp && r.rating > 0));
      }),
  },
  {
    key: 'star45',
    emoji: '⭐',
    label: '평균 4.5 맛집',
    hint: '리뷰 평균 4.5 이상인 기록 만들기',
    check: (c) =>
      c.monthDone.some((l) => {
        const avg = averageRating(c.reviews[l.id] ?? []);
        return avg != null && avg >= 4.5;
      }),
  },
  {
    key: 'review6',
    emoji: '✍️',
    label: '리뷰 6개',
    hint: '이달 기록에 리뷰 6개 쌓기',
    check: (c) => c.monthDone.reduce((n, l) => n + (c.reviews[l.id] ?? []).length, 0) >= 6,
  },
  {
    key: 'unanimous',
    emoji: '⚖️',
    label: '밸런스 만장일치',
    hint: '밸런스 게임에서 셋 다 같은 선택하기',
    check: (c) => {
      const byDate: Record<string, BalanceVote[]> = {};
      for (const v of c.votes) (byDate[v.date] ??= []).push(v);
      return Object.values(byDate).some(
        (vs) => vs.length >= MEMBER_EMPNOS.length && vs.every((v) => v.choice === vs[0].choice),
      );
    },
  },
  {
    key: 'vote10',
    emoji: '🗳️',
    label: '투표 10표',
    hint: '이달 밸런스 투표 합계 10표 모으기',
    check: (c) => c.votes.length >= 10,
  },
  {
    key: 'variety4',
    emoji: '🗺️',
    label: '가게 4곳 투어',
    hint: '이달에 서로 다른 가게 4곳 가기',
    check: (c) =>
      new Set(c.monthDone.map((l) => normalizeRestaurant(l.restaurant)).filter(Boolean)).size >= 4,
  },
];

// 3×3 판에서 줄이 되는 인덱스 조합
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function computeBingo(
  month: string, // yyyy-MM
  lunches: Lunch[],
  reviews: Record<number, LunchReview[]>,
  votes: BalanceVote[],
): BingoBoard {
  const allDone = lunches.filter((l) => l.status === 'done');
  const ctx: Ctx = {
    monthDone: allDone.filter((l) => l.date.startsWith(month)),
    allDone,
    reviews,
    votes,
  };

  // 월 시드로 미션 9개를 결정적으로 선택·배치
  const rand = mulberry32(hashSeed(`zzomul-bingo|${month}`));
  const shuffled = [...MISSIONS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, 9);

  const cells: BingoCell[] = picked.map((m) => ({
    key: m.key,
    emoji: m.emoji,
    label: m.label,
    hint: m.hint,
    done: m.check(ctx),
  }));
  const lines = LINES.filter((line) => line.every((i) => cells[i].done)).length;
  const doneCount = cells.filter((c) => c.done).length;
  return { month, cells, doneCount, lines, full: doneCount === 9 };
}
