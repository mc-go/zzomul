import { getDb } from './db';

// 프레첼 키우기 — 팀 전체 활동량(기록·리뷰·보고·댓글·메모·투표 개수 합)을
// 경험치로 환산해 레벨을 계산한다. 저장 없이 COUNT 조회 1번으로 결정.

export type TeamLevel = {
  level: number;
  exp: number; // 총 경험치 (= 활동 수 합)
  into: number; // 현재 레벨에서 쌓은 경험치
  need: number; // 현재 레벨을 채우는 데 필요한 경험치
  progress: number; // 0~1
};

// 레벨 n을 채우는 데 필요한 경험치 — 갈수록 조금씩 커짐 (10, 15, 20, ...)
function needFor(level: number): number {
  return 10 + (level - 1) * 5;
}

export function levelFromExp(exp: number): TeamLevel {
  let level = 1;
  let rest = exp;
  while (rest >= needFor(level)) {
    rest -= needFor(level);
    level += 1;
  }
  const need = needFor(level);
  return { level, exp, into: rest, need, progress: Math.min(rest / need, 1) };
}

export type ActivityCounts = {
  lunches: number;
  reviews: number;
  reports: number;
  comments: number;
  memos: number;
  votes: number;
};

export type RecentActivity = {
  kind: 'lunch' | 'review' | 'report' | 'comment' | 'memo' | 'vote';
  at: string; // UTC datetime
  label: string; // 기록이면 가게명, 그 외 빈 문자열
  actor: string; // 사번(리뷰/보고/댓글/메모/투표) 또는 userId(기록)
};

// 팀 활동량 조회 (종류별) — 테이블이 아직 없으면(첫 실행 직후 등) 0으로 취급
export async function fetchTeamActivity(): Promise<ActivityCounts> {
  const db = getDb();
  try {
    const res = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM lunches) AS lunches,
        (SELECT COUNT(*) FROM lunch_reviews) AS reviews,
        (SELECT COUNT(*) FROM reports) AS reports,
        (SELECT COUNT(*) FROM report_comments) AS comments,
        (SELECT COUNT(*) FROM memos) AS memos,
        (SELECT COUNT(*) FROM balance_votes) AS votes
    `);
    const row = res.rows[0] ?? {};
    return {
      lunches: Number(row.lunches ?? 0),
      reviews: Number(row.reviews ?? 0),
      reports: Number(row.reports ?? 0),
      comments: Number(row.comments ?? 0),
      memos: Number(row.memos ?? 0),
      votes: Number(row.votes ?? 0),
    };
  } catch {
    return { lunches: 0, reviews: 0, reports: 0, comments: 0, memos: 0, votes: 0 };
  }
}

export function totalExp(counts: ActivityCounts): number {
  return (
    counts.lunches + counts.reviews + counts.reports + counts.comments + counts.memos + counts.votes
  );
}

export type LevelUp = { level: number; at: string }; // 이 레벨을 달성한 시각(UTC)

// 전체 활동 시각을 오래된 순으로 — 레벨업 타임라인 계산용
// (리뷰/투표는 updated_at이라 수정하면 시각이 밀리는 근사치)
export async function fetchAllActivityDates(): Promise<string[]> {
  const db = getDb();
  try {
    const res = await db.execute(`
      SELECT created_at AS at FROM lunches
      UNION ALL SELECT updated_at FROM lunch_reviews
      UNION ALL SELECT created_at FROM reports
      UNION ALL SELECT created_at FROM report_comments
      UNION ALL SELECT created_at FROM memos
      UNION ALL SELECT updated_at FROM balance_votes
      ORDER BY at ASC
    `);
    return res.rows.map((row) => String(row.at ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

// 활동 시각들을 걸어가며 레벨업이 일어난 순간을 찾는다
export function computeLevelUps(datesAsc: string[]): LevelUp[] {
  const ups: LevelUp[] = [];
  let level = 1;
  let into = 0;
  for (const at of datesAsc) {
    into += 1;
    if (into >= needFor(level)) {
      into = 0;
      level += 1;
      ups.push({ level, at });
    }
  }
  return ups;
}

// 최근 경험치가 된 활동들 (모든 테이블 합쳐 최신순)
export async function fetchRecentActivities(limit = 6): Promise<RecentActivity[]> {
  const db = getDb();
  try {
    const res = await db.execute({
      sql: `
        SELECT 'lunch' AS kind, created_at AS at, restaurant AS label, created_by AS actor FROM lunches
        UNION ALL SELECT 'review', updated_at, '', reviewer_id FROM lunch_reviews
        UNION ALL SELECT 'report', created_at, '', author_id FROM reports
        UNION ALL SELECT 'comment', created_at, '', author_id FROM report_comments
        UNION ALL SELECT 'memo', created_at, '', author_id FROM memos
        UNION ALL SELECT 'vote', updated_at, '', voter_id FROM balance_votes
        ORDER BY at DESC LIMIT ?`,
      args: [limit],
    });
    return res.rows.map((row) => ({
      kind: String(row.kind) as RecentActivity['kind'],
      at: String(row.at ?? ''),
      label: String(row.label ?? ''),
      actor: String(row.actor ?? ''),
    }));
  } catch {
    return [];
  }
}
