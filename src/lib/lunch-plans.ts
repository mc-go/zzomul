import { getDb } from './db';

// 개인 점심 약속: "이날 나는 따로 점심 약속 있어요" 표시.
// 쪼물런치가 아닌 각자의 외부 약속을 캘린더에서 서로 알 수 있게 함.
// (emp_no, date) 조합당 1건 — 다시 저장하면 메모만 덮어씀.
export type LunchPlan = {
  empNo: string;
  date: string; // yyyy-MM-dd
  note: string; // 누구랑/어디서 등 자유 메모 (선택)
  updatedAt: string;
};

export async function ensureLunchPlansSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lunch_plans (
      emp_no TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (emp_no, date)
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_lunch_plans_date ON lunch_plans(date)`);
}

export async function listLunchPlans(): Promise<LunchPlan[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT emp_no, date, note, updated_at FROM lunch_plans ORDER BY date ASC`,
  );
  return res.rows.map((row) => ({
    empNo: String(row.emp_no),
    date: String(row.date),
    note: String(row.note ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }));
}

export async function upsertLunchPlan(empNo: string, date: string, note: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO lunch_plans (emp_no, date, note, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(emp_no, date) DO UPDATE SET
            note = excluded.note,
            updated_at = datetime('now')`,
    args: [empNo, date, note.trim()],
  });
}

export async function deleteLunchPlan(empNo: string, date: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM lunch_plans WHERE emp_no = ? AND date = ?`,
    args: [empNo, date],
  });
}
