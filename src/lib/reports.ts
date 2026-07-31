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

// 보고에 달리는 댓글
export type ReportComment = {
  id: number;
  reportId: number;
  authorId: string;
  content: string;
  createdAt: string;
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 보고 하나에 사람당 댓글 1개 (다시 쓰면 수정)
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_report_comments_unique ON report_comments(report_id, author_id)`,
  );
}

function rowToComment(row: Record<string, unknown>): ReportComment {
  return {
    id: Number(row.id),
    reportId: Number(row.report_id),
    authorId: String(row.author_id ?? ''),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

// 여러 보고의 댓글을 한 번에 조회해 reportId별로 그룹핑
export async function listCommentsForReports(
  reportIds: number[],
): Promise<Record<number, ReportComment[]>> {
  const map: Record<number, ReportComment[]> = {};
  if (reportIds.length === 0) return map;
  const db = getDb();
  const placeholders = reportIds.map(() => '?').join(',');
  const res = await db.execute({
    sql: `SELECT id, report_id, author_id, content, created_at
          FROM report_comments WHERE report_id IN (${placeholders}) ORDER BY id ASC`,
    args: reportIds,
  });
  for (const row of res.rows) {
    const c = rowToComment(row as Record<string, unknown>);
    (map[c.reportId] ??= []).push(c);
  }
  return map;
}

// 댓글 작성/수정 — 같은 보고에 이미 내 댓글이 있으면 내용을 덮어씀
export async function upsertReportComment(
  reportId: number,
  authorId: string,
  content: string,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO report_comments (report_id, author_id, content) VALUES (?, ?, ?)
          ON CONFLICT(report_id, author_id) DO UPDATE SET
            content = excluded.content,
            created_at = datetime('now')`,
    args: [reportId, authorId, content],
  });
}

export async function deleteReportComment(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM report_comments WHERE id = ?`, args: [id] });
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
