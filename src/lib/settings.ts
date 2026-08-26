import { getDb } from './db';

// 팀 공유 키-값 저장소 — 예: 절약 챌린지 개인 목표액

// 절약 챌린지 목표액 키 (사람별 × 연 단위)
export const savingsGoalKey = (empNo: string, year: string) => `savings.goal.${year}.${empNo}`;

// MBTI 키 (참여자별 — 퇴사자 등 EXTRA 포함 가능)
export const mbtiKey = (pid: string) => `mbti.${pid}`;

export const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const;

export async function ensureSettingsSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const res = await db.execute({ sql: `SELECT value FROM settings WHERE key = ?`, args: [key] });
  return res.rows.length > 0 ? String(res.rows[0].value ?? '') : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    args: [key, value],
  });
}
