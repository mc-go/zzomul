import { getDb } from './db';

// 오늘의 보고: 사람(작성자)당 하루 1건. 다시 저장하면 덮어씀.
export type Report = {
  id: number;
  date: string; // yyyy-MM-dd
  authorId: string; // 참여자 ID(사번)
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function ensureReportsSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, author_id)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC)`);
}

function rowToReport(row: Record<string, unknown>): Report {
  return {
    id: Number(row.id),
    date: String(row.date),
    authorId: String(row.author_id ?? ''),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

// 최근 보고 목록 (날짜 내림차순)
export async function listRecentReports(limit = 60): Promise<Report[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, date, author_id, content, created_at, updated_at
          FROM reports ORDER BY date DESC, id ASC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => rowToReport(r as Record<string, unknown>));
}

// 특정 날짜의 보고 (팝업용)
export async function listReportsForDate(date: string): Promise<Report[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, date, author_id, content, created_at, updated_at
          FROM reports WHERE date = ? ORDER BY id ASC`,
    args: [date],
  });
  return res.rows.map((r) => rowToReport(r as Record<string, unknown>));
}

// 작성/수정 (같은 날짜+작성자면 덮어씀)
export async function upsertReport(date: string, authorId: string, content: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO reports (date, author_id, content, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(date, author_id) DO UPDATE SET
            content = excluded.content,
            updated_at = datetime('now')`,
    args: [date, authorId, content],
  });
}

export async function deleteReport(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM reports WHERE id = ?`, args: [id] });
}
