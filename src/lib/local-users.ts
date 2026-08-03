import { getDb } from './db';

export type LocalUser = {
  username: string;
  role: 'konai' | 'guest';
  displayName: string;
  participantId: string;
};

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function ensureLocalUsersSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS local_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'guest',
      display_name TEXT NOT NULL DEFAULT '',
      participant_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 기본 게스트 계정 시딩: shpark / 1234 → 박소현 (ex_sohyun)
  const shparkHash = await sha256('1234');
  await db.execute({
    sql: `INSERT OR IGNORE INTO local_users
            (username, password_hash, role, display_name, participant_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: ['shpark', shparkHash, 'guest', '박소현', 'ex_sohyun'],
  });
}

export async function verifyLocalUser(
  username: string,
  password: string,
): Promise<LocalUser | null> {
  await ensureLocalUsersSchema();
  const db = getDb();
  const hash = await sha256(password);
  const res = await db.execute({
    sql: `SELECT username, role, display_name, participant_id
          FROM local_users WHERE username = ? AND password_hash = ?`,
    args: [username.trim(), hash],
  });
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    username: String(row.username),
    role: (String(row.role ?? 'guest') === 'konai' ? 'konai' : 'guest') as 'konai' | 'guest',
    displayName: String(row.display_name ?? ''),
    participantId: String(row.participant_id ?? ''),
  };
}
