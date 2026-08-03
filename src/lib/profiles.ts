import { getDb } from './db';

export type Profile = {
  id: string;
  empNo: string;
  name: string;
  iconKey: string;
  colorKey: string;
  photo: string;
  statusMessage: string;
  statusDate: string | null;
  updatedAt: string;
};

export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function ensureProfilesSchema(): Promise<void> {
  const db = getDb();

  // Legacy → new: 테이블/컬럼 이름 정리 (idempotent).
  try {
    await db.execute(`ALTER TABLE profiles RENAME TO users`);
  } catch {
    // 이미 리네임됐거나 원본 테이블 없음 — 무시
  }
  try {
    await db.execute(`ALTER TABLE users RENAME COLUMN email TO name`);
  } catch {
    // 이미 리네임됐거나 컬럼 없음 — 무시
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      emp_no TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      icon_key TEXT NOT NULL DEFAULT 'user',
      color_key TEXT NOT NULL DEFAULT 'slate',
      photo TEXT NOT NULL DEFAULT '',
      status_message TEXT NOT NULL DEFAULT '',
      status_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 오래된 스키마에 대비한 컬럼 백필
  const migrations = [
    `ALTER TABLE users ADD COLUMN photo TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN emp_no TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // duplicate column — ignore
    }
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_emp_no ON users(emp_no)`);
}

function rowToProfile(row: Record<string, unknown>): Profile {
  const today = todayString();
  const statusDate = row.status_date ? String(row.status_date) : null;
  const messageValid = statusDate === today;
  return {
    id: String(row.id),
    empNo: String(row.emp_no ?? ''),
    name: String(row.name ?? ''),
    iconKey: String(row.icon_key ?? 'user'),
    colorKey: String(row.color_key ?? 'slate'),
    photo: String(row.photo ?? ''),
    statusMessage: messageValid ? String(row.status_message ?? '') : '',
    statusDate: messageValid ? statusDate : null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function listProfiles(): Promise<Profile[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT id, emp_no, name, icon_key, color_key, photo, status_message, status_date, updated_at FROM users`,
  );
  return res.rows.map((r) => rowToProfile(r as Record<string, unknown>));
}

export type ProfileUpdate = {
  empNo?: string;
  name?: string;
  iconKey?: string;
  colorKey?: string;
  photo?: string;
  statusMessage?: string;
};

export async function upsertProfile(id: string, update: ProfileUpdate): Promise<void> {
  const db = getDb();
  const existing = (
    await db.execute({
      sql: `SELECT emp_no, name, icon_key, color_key, photo, status_message, status_date FROM users WHERE id = ?`,
      args: [id],
    })
  ).rows[0] as Record<string, unknown> | undefined;

  const empNo = update.empNo !== undefined ? update.empNo : String(existing?.emp_no ?? '');
  const name = update.name !== undefined ? update.name : String(existing?.name ?? '');
  const iconKey = update.iconKey ?? String(existing?.icon_key ?? 'user');
  const colorKey = update.colorKey ?? String(existing?.color_key ?? 'slate');
  const photo = update.photo !== undefined ? update.photo : String(existing?.photo ?? '');

  let statusMessage: string;
  let statusDate: string | null;
  if (update.statusMessage !== undefined) {
    statusMessage = update.statusMessage;
    statusDate = statusMessage.trim() ? todayString() : null;
  } else {
    statusMessage = String(existing?.status_message ?? '');
    statusDate = existing?.status_date ? String(existing.status_date) : null;
  }

  await db.execute({
    sql: `INSERT INTO users (id, emp_no, name, icon_key, color_key, photo, status_message, status_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            emp_no = excluded.emp_no,
            name = excluded.name,
            icon_key = excluded.icon_key,
            color_key = excluded.color_key,
            photo = excluded.photo,
            status_message = excluded.status_message,
            status_date = excluded.status_date,
            updated_at = datetime('now')`,
    args: [id, empNo, name, iconKey, colorKey, photo, statusMessage, statusDate],
  });
}
