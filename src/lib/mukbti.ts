import type { Lunch } from './lunches';
import type { LunchReview } from './reviews';
import { normalizeRestaurant } from './lunch-stats';

// 먹BTI — 개인의 먹기록·리뷰 패턴으로 입맛 유형을 계산 (저장 없음, 결정적).
// 축 1: 모험형(새 가게 비율 높음) vs 단골형 · 축 2: 천사입맛(별점 후함) vs 깐깐 미식가

export type MukBTI = {
  title: string; // 예: "모험형 천사입맛"
  emoji: string;
  description: string;
  stats: {
    participations: number; // 함께한 기록 수
    places: number; // 가본 가게 수
    adventureRatio: number; // 새로운 가게 비율 (0~1)
    avgRating: number | null; // 내 별점 평균
    reviewCount: number;
  };
} | null;

const MIN_PARTICIPATIONS = 5; // 이보다 적으면 유형 판정 보류

export function computeMukBTI(
  empNo: string,
  lunches: Lunch[],
  reviews: Record<number, LunchReview[]>,
): MukBTI {
  const mine = lunches.filter(
    (l) =>
      l.status === 'done' &&
      (l.participants.length === 0 || (l.participants as readonly string[]).includes(empNo)),
  );
  if (mine.length < MIN_PARTICIPATIONS) return null;

  const placeKeys = mine.map((l) => normalizeRestaurant(l.restaurant)).filter(Boolean);
  const places = new Set(placeKeys).size;
  const adventureRatio = placeKeys.length > 0 ? places / placeKeys.length : 0;

  const myRatings: number[] = [];
  let reviewCount = 0;
  for (const l of mine) {
    const r = (reviews[l.id] ?? []).find((rv) => rv.reviewerId === empNo);
    if (!r) continue;
    reviewCount += 1;
    if (r.rating > 0) myRatings.push(r.rating);
  }
  const avgRating =
    myRatings.length > 0 ? myRatings.reduce((a, b) => a + b, 0) / myRatings.length : null;

  const adventurous = adventureRatio >= 0.6;
  // 별점 데이터가 3개 미만이면 입맛 축은 "미지"로
  const tasteKnown = myRatings.length >= 3;
  const generous = avgRating != null && avgRating >= 4.0;

  const axis1 = adventurous ? '모험형' : '단골형';
  const axis2 = !tasteKnown ? '미지의 입맛' : generous ? '천사입맛' : '깐깐 미식가';
  const emoji = !tasteKnown ? '🕵️' : adventurous ? (generous ? '🍀' : '🌶️') : generous ? '🧸' : '🧐';
  const description = !tasteKnown
    ? '별점을 더 남기면 입맛 축이 밝혀져요'
    : adventurous
      ? generous
        ? '새로운 가게를 즐기고 웬만하면 다 맛있는 타입'
        : '새로운 곳에 도전하지만 평가는 냉정한 타입'
      : generous
        ? '검증된 단골집에서 행복을 찾는 타입'
        : '아는 맛만 찾는데 그마저도 깐깐한 타입';

  return {
    title: `${axis1} ${axis2}`,
    emoji,
    description,
    stats: {
      participations: mine.length,
      places,
      adventureRatio,
      avgRating,
      reviewCount,
    },
  };
}
