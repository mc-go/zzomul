import { getDb } from './db';

// 개인 점심 약속: "이날 나는 따로 점심 약속 있어요" 표시.
// 쪼물런치가 아닌 각자의 외부 약속을 캘린더에서 서로 알 수 있게 함.
// (emp_no, date) 조합당 1건 — 다시 저장하면 메모만 덮어씀.
export type LunchPlan = {
  empNo: string;
  date: string; // yyyy-MM-dd
  note: string; // 누구랑/어디서 등 자유 메모 (선택)
  updatedAt: string;
  fixed?: boolean; // 매주 반복되는 고정 약속(합성) — DB에 행 없음
  skipped?: boolean; // 고정 약속을 그날만 쉬어가는 표시 행 (약속으로 렌더링하면 안 됨)
};

// 매주 반복되는 고정 점심 약속 — DB 저장 없이 캘린더에서 합성한다.
// 공휴일이거나 휴가 등으로 점심시간에 근무가 아니면 표시하지 않고,
// 같은 날 본인이 직접 등록한 약속이 있으면 그쪽을 우선한다 (판정은 CalendarPage).
// 예외적으로 그날만 빼고 싶으면 토글로 skipped 행을 남긴다 (다시 켜면 행 삭제 → 복구).
export type RecurringLunchPlan = {
  empNo: string;
  weekday: number; // Date#getDay() 기준 (5 = 금요일)
  note: string;
};

export const RECURRING_LUNCH_PLANS: readonly RecurringLunchPlan[] = [
  // 고민채: 금요일마다 앱개발 팀 점심회식
  { empNo: '2023124', weekday: 5, note: '앱개발 팀 회식' },
];

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
  // 고정 약속 예외용 컬럼 — 이미 있으면 ALTER가 실패하므로 무시
  try {
    await db.execute(`ALTER TABLE lunch_plans ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* 중복 컬럼 — 무시 */
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_lunch_plans_date ON lunch_plans(date)`);
}

export async function listLunchPlans(): Promise<LunchPlan[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT emp_no, date, note, skipped, updated_at FROM lunch_plans ORDER BY date ASC`,
  );
  return res.rows.map((row) => ({
    empNo: String(row.emp_no),
    date: String(row.date),
    note: String(row.note ?? ''),
    skipped: Number(row.skipped ?? 0) === 1,
    updatedAt: String(row.updated_at ?? ''),
  }));
}

export async function upsertLunchPlan(empNo: string, date: string, note: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO lunch_plans (emp_no, date, note, skipped, updated_at)
          VALUES (?, ?, ?, 0, datetime('now'))
          ON CONFLICT(emp_no, date) DO UPDATE SET
            note = excluded.note,
            skipped = 0,
            updated_at = datetime('now')`,
    args: [empNo, date, note.trim()],
  });
}

// 매주 고정 약속을 그날만 쉬어가게 표시 (예: 회식이 취소된 금요일).
// 다시 켜려면 deleteLunchPlan으로 이 행을 지우면 고정 약속이 복구된다.
export async function skipRecurringLunchPlan(empNo: string, date: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO lunch_plans (emp_no, date, note, skipped, updated_at)
          VALUES (?, ?, '', 1, datetime('now'))
          ON CONFLICT(emp_no, date) DO UPDATE SET
            note = '',
            skipped = 1,
            updated_at = datetime('now')`,
    args: [empNo, date],
  });
}

export async function deleteLunchPlan(empNo: string, date: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM lunch_plans WHERE emp_no = ? AND date = ?`,
    args: [empNo, date],
  });
}
