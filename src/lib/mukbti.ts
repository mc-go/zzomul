import type { Lunch } from './lunches';
import type { LunchReview } from './reviews';
import { normalizeRestaurant } from './lunch-stats';

// 먹BTI — 개인의 먹기록·리뷰 패턴으로 입맛 유형을 계산 (저장 없음, 결정적).
// 축 1: 음식 장르 선호 — 방문 비율이 아니라 "내가 남긴 별점 반응"으로 판정
//   (쪼물런치는 다 같이 다녀서 방문 분포는 셋이 비슷함 — 장르별 내 평점 평균이 진짜 취향.
//    별점 2개 이상 쌓인 장르만 후보, 없으면 "잡식파". 동점이면 감탄 한줄평 수 → 표본 수 순)
// 축 2: 내 평균 별점(천사입맛/너그러운 입맛/균형 미식가/깐깐 미식가, 3개 미만이면 미지의 입맛)
// 여기에 먹을 때 중요시하는 것(아는 맛/편함/저녁 모임)과 별점·한줄평 스타일 칩, 최애 가게로 개성을 냄.

export type MukBTI = {
  title: string; // 예: "한식파 천사입맛"
  emoji: string;
  description: string;
  traits: string[]; // 개성 칩 (최대 4개, 데이터에서 자동 판정)
  favorite: { name: string; rating: number; count: number } | null; // 내 별점 최고 가게
  stats: {
    participations: number; // 함께한 기록 수
    places: number; // 가본 가게 수
    avgRating: number | null; // 내 별점 평균
    reviewCount: number;
  };
} | null;

const MIN_PARTICIPATIONS = 5; // 이보다 적으면 유형 판정 보류
const MIN_RATINGS = 3; // 별점이 이보다 적으면 입맛 축은 "미지"
const MIN_GENRE_RATINGS = 2; // 장르에 내 별점이 이보다 적으면 선호 판정에서 제외

// 한줄평에 감탄이 담겼는지 (느낌표·ㅋㅋ/ㅎㅎ·이모지)
const EXCITED_RE = /[!💯❤♥🤍🧡💛💚💙💜]|ㅋㅋ|ㅎㅎ|[\u{1F300}-\u{1FAFF}]/u;

// ----- 음식 장르 분류: 가게명+메뉴 텍스트 키워드 베스트에포트 (미분류는 집계 제외) -----
// 구체적인 장르(중식/일식/...)를 먼저 보고, 폭넓은 한식은 마지막에 매칭.
// 키워드는 자유롭게 추가 — 지난 결과가 바뀌어도 저장이 없어서 무해함.

const CUISINES: { key: string; emoji: string; pattern: RegExp }[] = [
  { key: '중식', emoji: '🥟', pattern: /짜장|짬뽕|탕수|마라|훠궈|딤섬|양꼬치|깐풍|유산슬|중식|중국|중화/ },
  {
    key: '일식',
    emoji: '🍣',
    pattern: /초밥|스시|사시미|라멘|우동|소바|돈까스|돈카츠|카츠|텐동|규동|덮밥|돈부리|오마카세|이자카야|샤브|일식|일본/,
  },
  {
    key: '아시아',
    emoji: '🍛',
    pattern: /쌀국수|분짜|반미|팟타이|똠얌|나시|미고랭|커리|카레|케밥|탄두리|베트남|태국|인도|아시안|월남/,
  },
  {
    key: '양식',
    emoji: '🍝',
    pattern: /파스타|피자|스파게티|버거|스테이크|리조또|리소토|브런치|샌드위치|샐러드|그라탕|오믈렛|양식|비스트로|타코|부리토|멕시칸/,
  },
  { key: '치킨', emoji: '🍗', pattern: /치킨|통닭|닭강정|후라이드|교촌|푸라닭|굽네|bhc|bbq/i },
  {
    key: '카페·간식',
    emoji: '🍰',
    pattern: /카페|커피|베이커리|케이크|디저트|도넛|도너츠|와플|빙수|쿠키|마카롱|아이스크림|젤라또|브레드/,
  },
  { key: '분식', emoji: '🍢', pattern: /떡볶이|분식|김밥|라볶이|튀김|순대|어묵|핫도그|컵밥|주먹밥|라면|토스트/ },
  {
    key: '한식',
    emoji: '🍚',
    pattern:
      /국밥|찌개|김치|비빔|불고기|갈비|곰탕|설렁탕|해장|백반|한정식|보쌈|족발|삼겹|구이|쌈|냉면|칼국수|수제비|감자탕|닭갈비|찜닭|백숙|삼계탕|전골|부대|국수|한식|정식|제육|청국장|두루치기|쭈꾸미|낙지|횟집|물회|순두부|추어|생선|고등어|갈치/,
  },
];

function classifyCuisine(text: string): (typeof CUISINES)[number] | null {
  for (const c of CUISINES) if (c.pattern.test(text)) return c;
  return null;
}

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

  // 내 리뷰 수집: 별점 + 한줄평 + 가게별 별점(최애 판정용)
  const myRatings: number[] = [];
  const myComments: string[] = [];
  const byPlace: Record<string, { name: string; ratings: number[] }> = {};
  let reviewCount = 0;
  for (const l of mine) {
    const r = (reviews[l.id] ?? []).find((rv) => rv.reviewerId === empNo);
    if (!r) continue;
    reviewCount += 1;
    if (r.comment.trim()) myComments.push(r.comment.trim());
    if (r.rating > 0) {
      myRatings.push(r.rating);
      const key = normalizeRestaurant(l.restaurant);
      if (key) {
        (byPlace[key] ??= { name: l.restaurant, ratings: [] }).ratings.push(r.rating);
        byPlace[key].name = l.restaurant; // 최신 기록의 표기명 사용
      }
    }
  }
  const avgRating =
    myRatings.length > 0 ? myRatings.reduce((a, b) => a + b, 0) / myRatings.length : null;

  // ----- 축 1: 음식 장르 선호 — 방문 횟수가 아니라 내가 남긴 별점·한줄평 반응으로 -----
  const genreStats = new Map<
    string,
    { info: (typeof CUISINES)[number]; ratings: number[]; excited: number }
  >();
  for (const l of mine) {
    const c = classifyCuisine(`${l.restaurant} ${l.menu ?? ''}`);
    if (!c) continue;
    const r = (reviews[l.id] ?? []).find((rv) => rv.reviewerId === empNo);
    if (!r || r.rating <= 0) continue; // 내 평이 없는 기록은 취향 판정에 안 씀
    const g = genreStats.get(c.key) ?? { info: c, ratings: [], excited: 0 };
    g.ratings.push(r.rating);
    if (r.comment.trim() && EXCITED_RE.test(r.comment)) g.excited += 1;
    genreStats.set(c.key, g);
  }
  // 내 평점 평균이 높은 장르가 선호 — 동점이면 감탄 한줄평 많은 쪽 → 표본 많은 쪽
  const rankedGenres = [...genreStats.values()]
    .filter((g) => g.ratings.length >= MIN_GENRE_RATINGS)
    .map((g) => ({ ...g, avg: g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length }))
    .sort(
      (a, b) => b.avg - a.avg || b.excited - a.excited || b.ratings.length - a.ratings.length,
    );
  const top = rankedGenres[0] ?? null;
  const second = rankedGenres[1] && rankedGenres[1].avg >= 4.0 ? rankedGenres[1] : null;
  const worst = rankedGenres.length >= 2 ? rankedGenres[rankedGenres.length - 1] : null;

  const axis1 = top ? `${top.info.key}파` : '잡식파';
  const emoji = top ? top.info.emoji : '🍽️';
  const cuisineText = top
    ? `평은 ${top.info.key}에 제일 후해요 (내 평 ⭐${top.avg.toFixed(1)} · ${top.ratings.length}번)`
    : '장르별 별점이 쌓이면 최애 장르가 밝혀져요';

  // ----- 축 2: 별점 입맛 -----
  const tasteKnown = myRatings.length >= MIN_RATINGS;
  const axis2 = !tasteKnown
    ? '미지의 입맛'
    : avgRating! >= 4.5
      ? '천사입맛'
      : avgRating! >= 4.0
        ? '너그러운 입맛'
        : avgRating! >= 3.5
          ? '균형 미식가'
          : '깐깐 미식가';
  const tasteText = !tasteKnown
    ? '별점을 더 남기면 입맛 축이 밝혀져요'
    : axis2 === '천사입맛'
      ? `평균 ⭐${avgRating!.toFixed(1)} — 웬만하면 다 맛있는 천사`
      : axis2 === '너그러운 입맛'
        ? `평균 ⭐${avgRating!.toFixed(1)} — 후하게 즐기는 타입`
        : axis2 === '균형 미식가'
          ? `평균 ⭐${avgRating!.toFixed(1)} — 맛있으면 맛있다, 아니면 아니다`
          : `평균 ⭐${avgRating!.toFixed(1)} — 별점이 쉽게 안 열리는 미식가`;

  const description = `${cuisineText} · ${tasteText}`;

  // ----- 개성 칩: 먹을 때 중요시하는 것 + 별점·한줄평 스타일 (최대 4개) -----
  const traits: string[] = [];
  if (second) traits.push(`🥈 부캐는 ${second.info.key}`);
  // 1위보다 평이 1점 이상 낮은 꼴찌 장르 — 확실히 안 맞는 장르
  if (top && worst && worst.info.key !== top.info.key && worst.avg <= top.avg - 1)
    traits.push(`🧊 ${worst.info.key}엔 깐깐`);
  // 재방문율: 가본 곳 수 대비 기록 수 — 아는 맛을 반복해서 찾는 성향
  if (placeKeys.length > 0 && 1 - places / placeKeys.length >= 0.5) traits.push('🔁 아는 맛 중시');
  if (mine.filter((l) => l.delivery).length / mine.length >= 0.5) traits.push('🛵 편하게 먹기 중시');
  if (mine.filter((l) => l.meal === 'dinner').length / mine.length >= 0.3)
    traits.push('🌙 저녁 모임파');
  if (myRatings.length >= MIN_RATINGS) {
    const mean = avgRating!;
    const stdev = Math.sqrt(
      myRatings.reduce((s, r) => s + (r - mean) ** 2, 0) / myRatings.length,
    );
    if (stdev >= 1.0) traits.push('🎢 별점 롤러코스터');
    else if (stdev <= 0.4) traits.push('📏 한결같은 별점');
    const fullRatio = myRatings.filter((r) => r >= 5).length / myRatings.length;
    if (fullRatio >= 0.4) traits.push('💯 만점 부자');
  }
  if (myComments.length > 0) {
    const avgLen = myComments.reduce((s, c) => s + c.length, 0) / myComments.length;
    if (avgLen >= 25) traits.push('✍️ 장문 리뷰어');
    else if (avgLen <= 10) traits.push('🎯 한줄 요약러');
    const excitedRatio = myComments.filter((c) => EXCITED_RE.test(c)).length / myComments.length;
    if (excitedRatio >= 0.5) traits.push('🎉 감탄 리뷰어');
  }
  if (reviewCount / mine.length >= 0.8) traits.push('🖊️ 성실 기록러');

  // ----- 최애 가게: 내 별점 평균 최고 (동점이면 더 많이 간 곳) -----
  let favorite: NonNullable<MukBTI>['favorite'] = null;
  for (const p of Object.values(byPlace)) {
    const avg = p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length;
    if (
      !favorite ||
      avg > favorite.rating ||
      (avg === favorite.rating && p.ratings.length > favorite.count)
    ) {
      favorite = { name: p.name, rating: avg, count: p.ratings.length };
    }
  }

  return {
    title: `${axis1} ${axis2}`,
    emoji,
    description,
    traits: traits.slice(0, 4),
    favorite,
    stats: {
      participations: mine.length,
      places,
      avgRating,
      reviewCount,
    },
  };
}

// ----- 입맛 궁합: 같은 기록에 두 사람이 남긴 별점 차이로 페어 궁합을 계산 (운세 탭 하단) -----

export type TasteMatch = {
  a: string; // 사번
  b: string;
  shared: number; // 둘 다 별점을 남긴 기록 수
  score: number | null; // 0~100 (shared가 MIN_SHARED 미만이면 null = 보류)
  emoji: string;
  label: string;
};

const MIN_SHARED = 3; // 같이 별점 남긴 기록이 이보다 적으면 궁합 보류

export function computeTasteMatches(
  empNos: readonly string[],
  reviews: Record<number, LunchReview[]>,
): TasteMatch[] {
  const matches: TasteMatch[] = [];
  for (let i = 0; i < empNos.length; i++) {
    for (let j = i + 1; j < empNos.length; j++) {
      const a = empNos[i];
      const b = empNos[j];
      const diffs: number[] = [];
      for (const rs of Object.values(reviews)) {
        const ra = rs.find((r) => r.reviewerId === a && r.rating > 0);
        const rb = rs.find((r) => r.reviewerId === b && r.rating > 0);
        if (ra && rb) diffs.push(Math.abs(ra.rating - rb.rating));
      }
      if (diffs.length < MIN_SHARED) {
        matches.push({ a, b, shared: diffs.length, score: null, emoji: '🔍', label: '탐색 중' });
        continue;
      }
      // 별점 차이 평균(최대 4)을 0~100 궁합으로 환산
      const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
      const score = Math.round(Math.max(0, Math.min(100, (1 - avgDiff / 4) * 100)));
      const [emoji, label] =
        score >= 90
          ? ['💘', '환상의 입맛 짝꿍']
          : score >= 75
            ? ['💞', '천생연분']
            : score >= 60
              ? ['🤝', '무난한 케미']
              : ['🎭', '취향 존중'];
      matches.push({ a, b, shared: diffs.length, score, emoji, label });
    }
  }
  // 점수 높은 페어부터 (보류는 맨 뒤)
  return matches.sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
}
