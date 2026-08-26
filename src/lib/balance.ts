import { getDb } from './db';
import { hashSeed, mulberry32 } from './fortune';
import { isValidParticipantId, type ParticipantId } from './members';

// 오늘의 밸런스 게임: 날짜를 시드로 질문 하나를 결정적으로 뽑고(운세와 같은 방식),
// 투표만 DB(balance_votes)에 저장. 같은 날엔 누가 봐도 같은 질문.
// 하루 1인 1표 — 다시 누르면 변경(upsert).

export type BalanceChoice = 'a' | 'b';

export type BalanceQuestion = {
  index: number; // 질문 풀 인덱스 (디버그용)
  topic: string; // 질문 머리말 (예: "오늘의 최애는?")
  a: string;
  b: string;
};

export type BalanceVote = {
  date: string;
  voterId: ParticipantId;
  choice: BalanceChoice;
  updatedAt: string;
};

// 음식 밸런스 질문 풀 — 추가는 자유, 삭제/순서 변경은 지난 날짜 질문이 바뀌니 주의
const QUESTIONS: { topic?: string; a: string; b: string }[] = [
  { a: '짜장면 🖤', b: '짬뽕 ❤️' },
  { a: '물냉면 🧊', b: '비빔냉면 🌶️' },
  { a: '부먹 🍯', b: '찍먹 🥢' },
  { a: '민트초코 호 🍦', b: '민트초코 불호 🙅' },
  { a: '파인애플 피자 OK 🍍', b: '피자에 과일 금지 🚫' },
  { a: '치킨은 후라이드 🍗', b: '치킨은 양념 🔴' },
  { a: '평생 밥만 🍚', b: '평생 면만 🍜' },
  { a: '삼겹살 🥓', b: '소고기 🥩' },
  { a: '김치찌개 🥘', b: '된장찌개 🍲' },
  { a: '떡볶이는 밀떡 🤍', b: '떡볶이는 쌀떡 🍡' },
  { a: '순대는 소금에 🧂', b: '순대는 떡볶이 국물에 🥄' },
  { a: '계란은 반숙 🍳', b: '계란은 완숙 🥚' },
  { a: '아침엔 빵 🥐', b: '아침엔 밥 🍙' },
  { a: '탕수육 大 하나 🐷', b: '탕수육+짜장+짬뽕 세트 🍱' },
  { a: '라면엔 계란 풀기 🌀', b: '계란 그대로 퐁당 🥚' },
  { a: '치즈 추가는 진리 🧀', b: '원래 맛이 최고 😌' },
  { a: '회사 앞 맛집 단골 🏠', b: '매일 새로운 곳 탐험 🗺️' },
  { a: '뜨거운 아메리카노 ☕', b: '아이스 아메리카노 🧊' },
  { a: '단짠단짠 🍭', b: '맵단맵단 🌶️' },
  { a: '국물 없인 못 살아 🍜', b: '국물 없어도 OK 🍛' },
  { a: '초밥 🍣', b: '회덮밥 🥗' },
  { a: '핫도그엔 케첩 🍅', b: '핫도그엔 머스타드 💛' },
  { a: '붕어빵 머리부터 🐟', b: '붕어빵 꼬리부터 🫧' },
  { a: '샐러드로 가볍게 🥗', b: '든든하게 한 끼 🍖' },
  { a: '점심에 매운 거 OK 🔥', b: '점심은 순한 맛 🕊️' },
  { a: '후식은 커피 ☕', b: '후식은 아이스크림 🍨' },
  { a: '먹으면서 얘기 🗣️', b: '먹을 땐 집중 🤐' },
  { a: '피자 도우는 씬 🥖', b: '피자 도우는 두툼 🍞' },
  { a: '감자튀김은 케첩 🍅', b: '감자튀김은 그냥 🍟' },
  { a: '컵라면 🥤', b: '봉지라면 🍳' },
  { a: '메뉴 고민 10분 🤔', b: '아무거나 3초 결정 ⚡', topic: '점심 메뉴 고를 때 나는?' },
  { a: '한식파 🇰🇷', b: '양식파 🍝' },
  { a: '마라탕 🌶️', b: '쌀국수 🍲' },
  { a: '족발 🐷', b: '보쌈 🥬' },
  { a: '빵은 단팥 🫘', b: '빵은 크림 🍦' },
  { a: '고수 환영 🌿', b: '고수 절대 금지 ⛔' },
];

const DEFAULT_TOPIC = '오늘의 밸런스 게임 ⚖️';

// 날짜(yyyy-MM-dd) 시드로 오늘의 질문을 결정적으로 선택
export function getBalanceQuestion(date: string): BalanceQuestion {
  const rand = mulberry32(hashSeed(`zzomul-balance|${date}`));
  const index = Math.floor(rand() * QUESTIONS.length);
  const q = QUESTIONS[index];
  return { index, topic: q.topic ?? DEFAULT_TOPIC, a: q.a, b: q.b };
}

export async function ensureBalanceSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS balance_votes (
      date TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      choice TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (date, voter_id)
    )
  `);
}

function rowsToVotes(rows: Record<string, unknown>[]): BalanceVote[] {
  const out: BalanceVote[] = [];
  for (const row of rows) {
    const voterId = String(row.voter_id ?? '');
    const choice = String(row.choice ?? '');
    if (!isValidParticipantId(voterId)) continue;
    if (choice !== 'a' && choice !== 'b') continue;
    out.push({
      date: String(row.date),
      voterId,
      choice,
      updatedAt: String(row.updated_at ?? ''),
    });
  }
  return out;
}

export async function listBalanceVotes(date: string): Promise<BalanceVote[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT date, voter_id, choice, updated_at FROM balance_votes WHERE date = ?`,
    args: [date],
  });
  return rowsToVotes(res.rows as Record<string, unknown>[]);
}

// 한 달치 투표 (빙고의 만장일치/참여 판정용)
export async function listBalanceVotesForMonth(month: string): Promise<BalanceVote[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT date, voter_id, choice, updated_at FROM balance_votes WHERE date LIKE ?`,
    args: [`${month}-%`],
  });
  return rowsToVotes(res.rows as Record<string, unknown>[]);
}

// 1인 1표 — 다시 투표하면 선택만 바뀜
export async function upsertBalanceVote(
  date: string,
  voterId: ParticipantId,
  choice: BalanceChoice,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO balance_votes (date, voter_id, choice, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(date, voter_id) DO UPDATE SET
            choice = excluded.choice,
            updated_at = datetime('now')`,
    args: [date, voterId, choice],
  });
}
