// 오늘의 운세: 생일 + 날짜를 시드로 한 결정적(deterministic) 생성.
// 같은 사람·같은 날이면 누가 언제 봐도 같은 운세가 나옴 (DB 저장 불필요).
// 생일은 anniversaries 테이블의 kind='birthday' 항목에서 가져옴.

export type Fortune = {
  score: number; // 1~5 (오늘의 운세 지수)
  headline: string; // 한 줄 총운 타이틀
  overall: string; // 총운 설명
  doToday: string; // 실행해야 할 것
  avoidToday: string; // 주의해야 할 것
  luckyItem: string; // 행운의 아이템
  luckyColor: { name: string; className: string }; // 행운의 색 (표시용 tailwind 클래스 포함)
  zodiac: { name: string; emoji: string }; // 별자리
  animal: { name: string; emoji: string }; // 띠
};

// ----- 시드 & PRNG (xmur3 + mulberry32) -----
// 밸런스 게임(balance.ts) 등 다른 "날짜 시드 결정적 생성"에서도 재사용

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----- 별자리 / 띠 -----

const ZODIACS: { name: string; emoji: string; from: [number, number] }[] = [
  { name: '염소자리', emoji: '🐐', from: [1, 1] },
  { name: '물병자리', emoji: '🏺', from: [1, 20] },
  { name: '물고기자리', emoji: '🐟', from: [2, 19] },
  { name: '양자리', emoji: '🐏', from: [3, 21] },
  { name: '황소자리', emoji: '🐂', from: [4, 20] },
  { name: '쌍둥이자리', emoji: '👯', from: [5, 21] },
  { name: '게자리', emoji: '🦀', from: [6, 22] },
  { name: '사자자리', emoji: '🦁', from: [7, 23] },
  { name: '처녀자리', emoji: '🌾', from: [8, 23] },
  { name: '천칭자리', emoji: '⚖️', from: [9, 23] },
  { name: '전갈자리', emoji: '🦂', from: [10, 23] },
  { name: '사수자리', emoji: '🏹', from: [11, 23] },
  { name: '염소자리', emoji: '🐐', from: [12, 22] },
];

function zodiacFor(month: number, day: number): { name: string; emoji: string } {
  let match = ZODIACS[0];
  for (const z of ZODIACS) {
    const [m, d] = z.from;
    if (month > m || (month === m && day >= d)) match = z;
  }
  return { name: match.name, emoji: match.emoji };
}

const ANIMALS: { name: string; emoji: string }[] = [
  { name: '원숭이띠', emoji: '🐵' }, // year % 12 === 0 (1992, 2004...)
  { name: '닭띠', emoji: '🐔' },
  { name: '개띠', emoji: '🐶' },
  { name: '돼지띠', emoji: '🐷' },
  { name: '쥐띠', emoji: '🐭' },
  { name: '소띠', emoji: '🐮' },
  { name: '호랑이띠', emoji: '🐯' },
  { name: '토끼띠', emoji: '🐰' },
  { name: '용띠', emoji: '🐲' },
  { name: '뱀띠', emoji: '🐍' },
  { name: '말띠', emoji: '🐴' },
  { name: '양띠', emoji: '🐑' },
];

// ----- 문구 풀 (사이트 컨셉: 사무실 + 점심 + 귀여움) -----

const HEADLINES_BY_SCORE: Record<number, string[]> = {
  5: ['오늘은 갓벽한 날! ✨', '운이 프레첼처럼 꼬여서 들어와요 🥨', '만사형통, 거칠 것이 없어요 🚀'],
  4: ['꽤 괜찮은 하루 예감 🌤️', '기분 좋은 일이 톡톡 터져요 🍿', '순풍에 돛 단 하루예요 ⛵'],
  3: ['무난무난, 평화로운 하루 ☁️', '잔잔한 호수 같은 날이에요 🛶', '중심만 잡으면 OK인 날 ⚖️'],
  2: ['살짝 조심스러운 날이에요 🌦️', '천천히 가도 괜찮아요 🐢', '커피 한 잔의 여유가 필요해요 ☕'],
  1: ['오늘은 안전 운전 모드 🚧', '이불 밖은 위험할 뻔한 날 🛌', '심호흡 세 번이 필요한 날 🌬️'],
};

const OVERALLS: string[] = [
  '작은 우연이 좋은 인연으로 이어지는 날이에요. 지나가는 말 한마디도 잘 들어보세요.',
  '미뤄뒀던 일이 의외로 술술 풀려요. 오전에 시동을 걸면 오후가 편해져요.',
  '주변 사람의 도움 운이 강한 날! 혼자 끙끙대지 말고 살짝 기대보세요.',
  '집중력이 반짝이는 날이에요. 어려운 일은 점심 전에 해치우는 게 이득!',
  '예상치 못한 칭찬이 들어올 수 있어요. 겸손하되 씨익 웃어주세요.',
  '오후로 갈수록 운이 차오르는 상승형 하루예요. 초반 실수에 기죽지 마세요.',
  '먹는 게 곧 복인 날! 맛있는 한 끼가 하루의 흐름을 바꿔줘요.',
  '소소한 행운이 세 번 찾아와요. 놓치지 않으려면 주변을 잘 둘러보세요.',
  '말 한마디가 천 냥 빚을 갚는 날. 따뜻한 인사가 행운의 문을 열어요.',
  '정리의 기운이 흐르는 날이에요. 책상 위든 할 일이든, 비우면 채워져요.',
  '직감이 유난히 잘 맞는 날! 고민되면 처음 떠오른 쪽을 골라보세요.',
  '느긋함이 오히려 득이 되는 날이에요. 서두르지 않아도 다 제시간에 도착해요.',
  '새로운 시도에 우주가 살짝 힘을 보태주는 날! 반 발짝만 내밀어보세요.',
  '주고받는 기운이 좋은 날이에요. 간식 하나 나누면 두 배로 돌아와요.',
];

const DO_TODAY: string[] = [
  '점심 먹고 10분 산책하기 — 오후 운이 확 올라가요 🚶',
  '미뤄둔 메시지에 답장 보내기 — 좋은 소식이 따라와요 💌',
  '동료에게 먼저 커피 제안하기 — 인연 운이 반짝여요 ☕',
  '책상 위 정리 5분 — 막힌 일이 뚫려요 🧹',
  '오늘 안에 작은 일 하나 끝내기 — 성취감이 행운을 불러요 ✅',
  '물 자주 마시기 — 컨디션이 운세를 이겨요 💧',
  '창밖 하늘 한 번 올려다보기 — 좋은 아이디어가 떠올라요 ☁️',
  '고마운 사람에게 짧게라도 표현하기 — 복이 쌓여요 🙏',
  '점심 메뉴는 따뜻한 국물로 — 속이 편해야 일이 풀려요 🍲',
  '스트레칭 한 번 쭉 — 뭉친 어깨와 함께 걱정도 풀려요 🧘',
  '메모장에 떠오른 생각 적어두기 — 나중에 보물이 돼요 📝',
  '엘리베이터 대신 계단 한 층 — 발걸음에 운이 붙어요 🪜',
  '오늘의 보고 쓰기 — 기록하는 사람에게 행운이 와요 📢',
  '디저트 하나로 나를 칭찬하기 — 당 충전이 곧 운 충전 🍰',
];

const AVOID_TODAY: string[] = [
  '오후 3시 이후의 충동구매 — 장바구니에 하루만 재워두세요 🛒',
  '빈속에 아이스 아메리카노 — 속이 놀라면 운도 놀라요 🧊',
  '단톡방에서의 성급한 답장 — 한 번 더 읽고 보내세요 💬',
  '지각 — 오늘은 특히 아침 시간이 빠듯할 수 있어요 ⏰',
  '남과 비교하기 — 내 페이스가 제일 좋은 페이스예요 🐾',
  '매운 걸로 스트레스 풀기 — 오늘은 속이 예민할 수 있어요 🌶️',
  '점심 시간 낭비하는 회의 — 밥은 제때 먹어야 해요 🍚',
  '완벽주의 발동 — 80점이면 충분히 훌륭한 날이에요 💯',
  '무리한 야근 — 오늘의 체력은 내일을 위한 저금이에요 🔋',
  '뒷말 섞인 대화 — 흘려듣고 얼른 자리를 뜨세요 🤫',
  '휴대폰 무한 스크롤 — 눈과 운이 같이 피로해져요 📱',
  '결정 미루기 — 작은 선택은 오늘 끝내는 게 좋아요 🎯',
  '차가운 자리에 오래 앉기 — 따뜻하게 챙겨 입으세요 🧣',
  '점심 거르기 — 오늘 운세의 절반은 밥심이에요 🍙',
];

const LUCKY_ITEMS: string[] = [
  '프레첼 🥨',
  '따뜻한 라떼 ☕',
  '포스트잇 🟨',
  '립밤 💄',
  '초콜릿 한 조각 🍫',
  '텀블러 🥤',
  '볼펜 🖊️',
  '이어폰 🎧',
  '손거울 🪞',
  '귤 🍊',
  '핸드크림 🧴',
  '우산 ☂️',
  '스티커 ✨',
  '젤리 🍬',
];

const LUCKY_COLORS: { name: string; className: string }[] = [
  { name: '크림', className: 'bg-amber-100' },
  { name: '하늘색', className: 'bg-sky-300' },
  { name: '민트', className: 'bg-emerald-300' },
  { name: '살구색', className: 'bg-orange-200' },
  { name: '라벤더', className: 'bg-violet-300' },
  { name: '핑크', className: 'bg-pink-300' },
  { name: '레몬', className: 'bg-yellow-300' },
  { name: '카키', className: 'bg-lime-600' },
  { name: '네이비', className: 'bg-blue-800' },
  { name: '브라운', className: 'bg-amber-700' },
];

// ----- 생성기 -----

function pick<T>(rand: () => number, pool: T[]): T {
  return pool[Math.floor(rand() * pool.length)];
}

// birthDate: 'yyyy-MM-dd', date: 오늘 'yyyy-MM-dd'
export function getFortune(empNo: string, birthDate: string, date: string): Fortune {
  const rand = mulberry32(hashSeed(`zzomul-fortune|${empNo}|${birthDate}|${date}`));

  // 점수는 3~5가 잘 나오게 가중치 (기분 좋은 앱이니까 1점은 드물게)
  const roll = rand();
  const score = roll < 0.05 ? 1 : roll < 0.15 ? 2 : roll < 0.45 ? 3 : roll < 0.8 ? 4 : 5;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const year = m ? Number(m[1]) : 2000;
  const month = m ? Number(m[2]) : 1;
  const day = m ? Number(m[3]) : 1;

  return {
    score,
    headline: pick(rand, HEADLINES_BY_SCORE[score]),
    overall: pick(rand, OVERALLS),
    doToday: pick(rand, DO_TODAY),
    avoidToday: pick(rand, AVOID_TODAY),
    luckyItem: pick(rand, LUCKY_ITEMS),
    luckyColor: pick(rand, LUCKY_COLORS),
    zodiac: zodiacFor(month, day),
    animal: ANIMALS[((year % 12) + 12) % 12],
  };
}
