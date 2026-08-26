import { format, getDaysInMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import type { Lunch } from './lunches';
import type { LunchReview } from './reviews';
import { normalizeRestaurant } from './lunch-stats';
import { hashSeed, mulberry32 } from './fortune';

// 월간 결산: 매월 1~5일 사이 첫 접속 팝업에 지난달 먹기록 요약 +
// 새 달 맛집 추천(위시리스트 기반, 계절·안 가본 곳 고려) + 응원 한마디를 보여준다.
// 전부 계산만 — DB 저장 없음. 추천/응원은 월 시드로 결정적이라 같은 달엔 누가 봐도 같다.

// 매월 1~N일에만 결산을 띄움 (1일에 접속 안 해도 놓치지 않게 여유를 둠)
const RECAP_WINDOW_LAST_DAY = 5;

export function inRecapWindow(today: Date): boolean {
  return today.getDate() <= RECAP_WINDOW_LAST_DAY;
}

// 연말 시즌: 12월 마지막 주(월요일 시작)의 한 주 전부터 연말까지 — 연말 리캡·맛집 월드컵 공용
export function isYearEndSeason(today: Date): boolean {
  if (today.getMonth() !== 11) return false;
  const lastWeekStart = startOfWeek(new Date(today.getFullYear(), 11, 31), { weekStartsOn: 1 });
  const windowStart = subDays(lastWeekStart, 7);
  return today.getTime() >= windowStart.getTime();
}

export type YearlyRecap = {
  year: string;
  total: number;
  lunchCount: number;
  dinnerCount: number;
  places: number; // 방문한 가게 수
  topPlace: { name: string; count: number } | null;
  reviewCount: number;
};

// 연말 리캡 — 올해 총결산 (연말 시즌에만, 기록 없으면 null)
export function getYearlyRecap(
  lunches: Lunch[],
  reviews: Record<number, LunchReview[]>,
  today: Date,
): YearlyRecap | null {
  if (!isYearEndSeason(today)) return null;
  const year = String(today.getFullYear());
  const done = lunches.filter((l) => l.status === 'done' && l.date.startsWith(year));
  if (done.length === 0) return null;
  const byPlace: Record<string, { name: string; count: number }> = {};
  for (const l of done) {
    const key = normalizeRestaurant(l.restaurant);
    if (!key) continue;
    (byPlace[key] ??= { name: l.restaurant, count: 0 }).count += 1;
  }
  const placesAll = Object.values(byPlace).sort((a, b) => b.count - a.count);
  const lunchCount = done.filter((l) => l.meal === 'lunch').length;
  return {
    year,
    total: done.length,
    lunchCount,
    dinnerCount: done.length - lunchCount,
    places: placesAll.length,
    topPlace: placesAll[0] ?? null,
    reviewCount: done.reduce((n, l) => n + (reviews[l.id] ?? []).length, 0),
  };
}

export type MonthlyRecap = {
  monthLabel: string; // 지난달 (예: "8월")
  newMonthLabel: string; // 새 달 (예: "9월")
  lunchCount: number;
  dinnerCount: number;
  total: number;
  perWeek: number; // 주 평균 (소수 1자리)
  places: { name: string; count: number }[]; // 많이 간 순 상위
  morePlaces: number; // 상위 밖 가게 수
  recommendation: { restaurant: string; menu: string; reason: string } | null;
  wishlistEmpty: boolean; // 추천 못 한 이유가 "위시리스트가 빔"일 때 안내용
  cheer: string;
};

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 가게명+메뉴 텍스트에서 계절 메뉴를 찾는 키워드 — 추가는 자유
const SEASON_KEYWORDS: Record<Season, string[]> = {
  spring: ['비빔밥', '나물', '쌈밥', '봄', '딸기', '두릅'],
  summer: ['냉면', '막국수', '콩국수', '냉모밀', '메밀', '물회', '초계', '빙수', '삼계탕', '냉국'],
  autumn: ['전어', '대하', '꽃게', '추어탕', '버섯', '가을', '송이'],
  winter: ['국밥', '전골', '샤브', '나베', '어묵', '오뎅', '굴', '방어', '칼국수', '수제비', '짬뽕', '우동'],
};

const SEASON_REASON: Record<Season, string> = {
  spring: '봄기운 가득한 메뉴라 골랐어요 🌸',
  summer: '더위를 날려줄 여름 메뉴라 골랐어요 🧊',
  autumn: '가을에 딱 어울리는 메뉴라 골랐어요 🍂',
  winter: '몸을 데워줄 겨울 메뉴라 골랐어요 ♨️',
};

const CHEERS = [
  '이번 달도 든든하게 먹고 힘내요! 💪',
  '새로운 달, 새로운 맛집! 벌써 기대돼요 ✨',
  '잘 먹는 게 남는 거예요. 이번 달도 화이팅! 🥄',
  '지난달도 고생 많았어요. 이번 달은 더 맛있을 거예요 🍀',
  '맛있는 점심이 있는 한, 이번 달도 문제없어요 😎',
  '한 입 한 입 소중하게, 이번 달도 즐겁게! 🥨',
];

// 결산 계산 — 결산 기간이 아니거나 지난달 기록이 없으면 null
export function getMonthlyRecap(lunches: Lunch[], today: Date): MonthlyRecap | null {
  if (!inRecapWindow(today)) return null;
  const prev = subMonths(today, 1);
  const prevKey = format(prev, 'yyyy-MM');
  const doneLastMonth = lunches.filter((l) => l.status === 'done' && l.date.startsWith(prevKey));
  if (doneLastMonth.length === 0) return null;

  const lunchCount = doneLastMonth.filter((l) => l.meal === 'lunch').length;
  const dinnerCount = doneLastMonth.length - lunchCount;
  const perWeek = Math.round((doneLastMonth.length / (getDaysInMonth(prev) / 7)) * 10) / 10;

  // 뭐뭐 먹었는지 — 가게별 횟수, 많이 간 순 상위 6곳
  const byPlace: Record<string, { name: string; count: number }> = {};
  for (const l of doneLastMonth) {
    const key = normalizeRestaurant(l.restaurant);
    if (!key) continue;
    (byPlace[key] ??= { name: l.restaurant, count: 0 }).count += 1;
  }
  const placesAll = Object.values(byPlace).sort((a, b) => b.count - a.count);
  const places = placesAll.slice(0, 6);
  const morePlaces = placesAll.length - places.length;

  // 새 달 추천 — 위시리스트에서: ① 아직 안 가본 곳 우선 ② 그중 새 달 계절 메뉴 우선.
  // 최종 후보가 여럿이면 월 시드로 하나를 결정적으로 뽑는다.
  const monthKey = format(today, 'yyyy-MM');
  const rand = mulberry32(hashSeed(`zzomul-recap|${monthKey}`));
  const visited = new Set(
    lunches.filter((l) => l.status === 'done').map((l) => normalizeRestaurant(l.restaurant)),
  );
  const wish = lunches.filter((l) => l.status === 'wishlist' && l.restaurant.trim());
  const unvisited = wish.filter((w) => !visited.has(normalizeRestaurant(w.restaurant)));
  const pool = unvisited.length > 0 ? unvisited : wish;
  const season = seasonOf(today.getMonth() + 1);
  const seasonal = pool.filter((w) =>
    SEASON_KEYWORDS[season].some((k) => `${w.restaurant} ${w.menu}`.includes(k)),
  );
  const candidates = seasonal.length > 0 ? seasonal : pool;
  let recommendation: MonthlyRecap['recommendation'] = null;
  if (candidates.length > 0) {
    const picked = candidates[Math.floor(rand() * candidates.length)];
    recommendation = {
      restaurant: picked.restaurant,
      menu: picked.menu,
      reason:
        seasonal.length > 0
          ? SEASON_REASON[season]
          : unvisited.length > 0
            ? '아직 안 가본 곳이라 골랐어요 👀'
            : '위시리스트에서 골랐어요 📌',
    };
  }

  return {
    monthLabel: `${prev.getMonth() + 1}월`,
    newMonthLabel: `${today.getMonth() + 1}월`,
    lunchCount,
    dinnerCount,
    total: doneLastMonth.length,
    perWeek,
    places,
    morePlaces,
    recommendation,
    wishlistEmpty: wish.length === 0,
    cheer: CHEERS[Math.floor(rand() * CHEERS.length)],
  };
}
