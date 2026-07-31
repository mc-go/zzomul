import { getDb } from './db';

export type DailyStatus = {
  empNo: string;
  date: string;
  message: string;
  updatedAt: string;
};

export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function ensureStatusesSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_statuses (
      emp_no TEXT NOT NULL,
      date TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (emp_no, date)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_daily_statuses_date ON daily_statuses(date)`,
  );
  // 기존 profiles.status_message → daily_statuses 로 백필 (idempotent)
  try {
    await db.execute(`
      INSERT OR IGNORE INTO daily_statuses (emp_no, date, message)
      SELECT emp_no, status_date, status_message
      FROM profiles
      WHERE emp_no != ''
        AND status_date IS NOT NULL
        AND status_date != ''
        AND status_message != ''
    `);
  } catch {
    // profiles 테이블이 아직 없거나 컬럼이 없을 수 있음 — 무시
  }
}

export async function listStatuses(): Promise<DailyStatus[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT emp_no, date, message, updated_at FROM daily_statuses ORDER BY date DESC`,
  );
  return res.rows.map((row) => ({
    empNo: String(row.emp_no),
    date: String(row.date),
    message: String(row.message ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }));
}

export async function upsertStatus(
  empNo: string,
  date: string,
  message: string,
): Promise<void> {
  const db = getDb();
  const trimmed = message.trim();
  if (!trimmed) {
    await db.execute({
      sql: `DELETE FROM daily_statuses WHERE emp_no = ? AND date = ?`,
      args: [empNo, date],
    });
    return;
  }
  await db.execute({
    sql: `INSERT INTO daily_statuses (emp_no, date, message, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(emp_no, date) DO UPDATE SET
            message = excluded.message,
            updated_at = datetime('now')`,
    args: [empNo, date, trimmed],
  });
}
