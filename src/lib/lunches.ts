import { getDb } from './db';
import { ALL_PARTICIPANT_IDS, isValidParticipantId, type ParticipantId } from './members';

export type MealType = 'lunch' | 'dinner';
export type LunchStatus = 'wishlist' | 'done';

export type LunchInput = {
  date: string;
  meal: MealType;
  status: LunchStatus;
  restaurant: string;
  menu: string;
  rating: number;
  comment: string;
  link: string;
  plannedDate: string | null;
  delivery: boolean; // 배달로 먹는 기록 (매장 방문과 구분)
  participants: ParticipantId[];
  createdBy: string;
};

export type Lunch = {
  id: number;
  date: string;
  meal: MealType;
  status: LunchStatus;
  restaurant: string;
  menu: string;
  rating: number;
  comment: string;
  link: string;
  plannedDate: string | null;
  delivery: boolean;
  participants: ParticipantId[];
  createdBy: string;
  createdAt: string;
};

// 한줄평은 여기서 받지 않음 — 작성자 본인의 평(lunch_reviews)으로 따로 저장해야 함.
// (lunches.comment에 쓰면 예전 이관 로직처럼 작성자가 뒤바뀌는 사고가 남)
export type PromoteInput = {
  id: number;
  date: string;
  rating: number;
  participants: ParticipantId[];
};

export async function ensureSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lunches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal TEXT NOT NULL DEFAULT 'lunch',
      status TEXT NOT NULL DEFAULT 'done',
      restaurant TEXT NOT NULL,
      menu TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      planned_date TEXT,
      link TEXT NOT NULL DEFAULT '',
      participants TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 기존 테이블 마이그레이션: 컬럼이 없으면 추가. 이미 있으면 무시.
  const migrations = [
    `ALTER TABLE lunches ADD COLUMN meal TEXT NOT NULL DEFAULT 'lunch'`,
    `ALTER TABLE lunches ADD COLUMN status TEXT NOT NULL DEFAULT 'done'`,
    `ALTER TABLE lunches ADD COLUMN planned_date TEXT`,
    `ALTER TABLE lunches ADD COLUMN link TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE lunches ADD COLUMN is_delivery INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // duplicate column — ignore
    }
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_lunches_date ON lunches(date DESC)`);
}

function parseParticipants(raw: unknown): ParticipantId[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is ParticipantId => typeof v === 'string' && isValidParticipantId(v));
  } catch {
    return [];
  }
}

export async function listLunches(): Promise<Lunch[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT id, date, meal, status, restaurant, menu, rating, comment,
            link, planned_date, is_delivery, participants, created_by, created_at
     FROM lunches ORDER BY date DESC, id DESC`,
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    date: String(row.date),
    meal: (String(row.meal ?? 'lunch') === 'dinner' ? 'dinner' : 'lunch') as MealType,
    status: (String(row.status ?? 'done') === 'wishlist' ? 'wishlist' : 'done') as LunchStatus,
    restaurant: String(row.restaurant),
    menu: String(row.menu ?? ''),
    rating: Number(row.rating ?? 0),
    comment: String(row.comment ?? ''),
    link: String(row.link ?? ''),
    plannedDate: row.planned_date ? String(row.planned_date) : null,
    delivery: Number(row.is_delivery ?? 0) === 1,
    participants: parseParticipants(row.participants),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
  }));
}

export async function createLunch(input: LunchInput): Promise<void> {
  const db = getDb();
  const participants = input.participants.filter((p): p is ParticipantId =>
    (ALL_PARTICIPANT_IDS as readonly string[]).includes(p),
  );
  await db.execute({
    sql: `INSERT INTO lunches
            (date, meal, status, restaurant, menu, rating, comment,
             link, planned_date, is_delivery, participants, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.date,
      input.meal,
      input.status,
      input.restaurant,
      input.menu,
      Math.max(0, Math.min(5, Math.round(input.rating * 2) / 2)),
      input.comment,
      input.link,
      input.plannedDate ?? null,
      input.delivery ? 1 : 0,
      JSON.stringify(participants),
      input.createdBy,
    ],
  });
}

export type UpdateLunchInput = {
  id: number;
  date: string;
  meal: MealType;
  restaurant: string;
  menu: string;
  rating: number;
  comment: string;
  link: string;
  plannedDate: string | null;
  delivery: boolean;
  participants: ParticipantId[];
};

export async function updateLunch(input: UpdateLunchInput): Promise<void> {
  const db = getDb();
  const participants = input.participants.filter((p): p is ParticipantId =>
    (ALL_PARTICIPANT_IDS as readonly string[]).includes(p),
  );
  await db.execute({
    sql: `UPDATE lunches
          SET date = ?, meal = ?, restaurant = ?, menu = ?, rating = ?, comment = ?,
              link = ?, planned_date = ?, is_delivery = ?, participants = ?
          WHERE id = ?`,
    args: [
      input.date,
      input.meal,
      input.restaurant,
      input.menu,
      Math.max(0, Math.min(5, Math.round(input.rating * 2) / 2)),
      input.comment,
      input.link,
      input.plannedDate ?? null,
      input.delivery ? 1 : 0,
      JSON.stringify(participants),
      input.id,
    ],
  });
}

export async function promoteLunch(input: PromoteInput): Promise<void> {
  const db = getDb();
  const participants = input.participants.filter((p): p is ParticipantId =>
    (ALL_PARTICIPANT_IDS as readonly string[]).includes(p),
  );
  await db.execute({
    sql: `UPDATE lunches
          SET status = 'done',
              date = ?,
              rating = ?,
              participants = ?,
              planned_date = NULL
          WHERE id = ?`,
    args: [
      input.date,
      Math.max(0, Math.min(5, Math.round(input.rating * 2) / 2)),
      JSON.stringify(participants),
      input.id,
    ],
  });
}

export async function deleteLunch(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM lunches WHERE id = ?`, args: [id] });
}
