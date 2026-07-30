import { getDb } from './db';

export type Profile = {
  id: string;
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      icon_key TEXT NOT NULL DEFAULT 'user',
      color_key TEXT NOT NULL DEFAULT 'slate',
      photo TEXT NOT NULL DEFAULT '',
      status_message TEXT NOT NULL DEFAULT '',
      status_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 기존 테이블 마이그레이션 (photo 컬럼 추가). 이미 있으면 무시.
  try {
    await db.execute(`ALTER TABLE profiles ADD COLUMN photo TEXT NOT NULL DEFAULT ''`);
  } catch {
    // duplicate column
  }
}

function rowToProfile(row: Record<string, unknown>): Profile {
  const today = todayString();
  const statusDate = row.status_date ? String(row.status_date) : null;
  const messageValid = statusDate === today;
  return {
    id: String(row.id),
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
    `SELECT id, icon_key, color_key, photo, status_message, status_date, updated_at FROM profiles`,
  );
  return res.rows.map((r) => rowToProfile(r as Record<string, unknown>));
}

export type ProfileUpdate = {
  iconKey?: string;
  colorKey?: string;
  photo?: string;
  statusMessage?: string;
};

export async function upsertProfile(id: string, update: ProfileUpdate): Promise<void> {
  const db = getDb();
  const existing = (
    await db.execute({
      sql: `SELECT icon_key, color_key, photo, status_message, status_date FROM profiles WHERE id = ?`,
      args: [id],
    })
  ).rows[0] as Record<string, unknown> | undefined;

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
    sql: `INSERT INTO profiles (id, icon_key, color_key, photo, status_message, status_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            icon_key = excluded.icon_key,
            color_key = excluded.color_key,
            photo = excluded.photo,
            status_message = excluded.status_message,
            status_date = excluded.status_date,
            updated_at = datetime('now')`,
    args: [id, iconKey, colorKey, photo, statusMessage, statusDate],
  });
}
