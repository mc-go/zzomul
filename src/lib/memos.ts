import { getDb } from './db';

// 아무거나 탭: 자유 메모장. 사람마다 여러 개 쓸 수 있음.
export type Memo = {
  id: number;
  authorId: string; // 참여자 ID(사번) 또는 게스트 participant_id
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function ensureMemosSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_memos_created ON memos(created_at DESC)`);
}

function rowToMemo(row: Record<string, unknown>): Memo {
  return {
    id: Number(row.id),
    authorId: String(row.author_id ?? ''),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function listMemos(limit = 200): Promise<Memo[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, author_id, content, created_at, updated_at
          FROM memos ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => rowToMemo(r as Record<string, unknown>));
}

export async function createMemo(authorId: string, content: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO memos (author_id, content) VALUES (?, ?)`,
    args: [authorId, content],
  });
}

export async function updateMemo(id: number, content: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE memos SET content = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [content, id],
  });
}

export async function deleteMemo(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM memos WHERE id = ?`, args: [id] });
}
