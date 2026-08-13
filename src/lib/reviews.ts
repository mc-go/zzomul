import { getDb } from './db';
import { isValidParticipantId, type ParticipantId } from './members';

// 먹기록(lunches) 한 건에 대해 각 참여자가 남기는 개별 평.
// (lunch_id, reviewer_id) 조합당 1개 — 다시 저장하면 덮어씀.
export type LunchReview = {
  lunchId: number;
  reviewerId: ParticipantId;
  rating: number;
  comment: string;
  updatedAt: string;
};

export async function ensureReviewsSchema(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lunch_reviews (
      lunch_id INTEGER NOT NULL,
      reviewer_id TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (lunch_id, reviewer_id)
    )
  `);
  // ⚠ 예전에 있던 "lunches.comment → 고민채 평" 1회성 이관은 제거됨 —
  // 다녀왔어요 한줄평까지 남의 평으로 옮겨버리는 버그의 원인이었음. 재도입 금지.
}

// 전체 리뷰를 한 번에 읽어 lunchId별로 그룹핑 (기록 목록 화면에서 join 대신 사용)
export async function listAllReviews(): Promise<Record<number, LunchReview[]>> {
  const db = getDb();
  const res = await db.execute(
    `SELECT lunch_id, reviewer_id, rating, comment, updated_at
     FROM lunch_reviews ORDER BY updated_at ASC`,
  );
  const map: Record<number, LunchReview[]> = {};
  for (const row of res.rows) {
    const reviewerId = String(row.reviewer_id ?? '');
    if (!isValidParticipantId(reviewerId)) continue; // 알 수 없는 리뷰어는 무시
    const lunchId = Number(row.lunch_id);
    const review: LunchReview = {
      lunchId,
      reviewerId,
      rating: Number(row.rating ?? 0),
      comment: String(row.comment ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    };
    (map[lunchId] ??= []).push(review);
  }
  return map;
}

export async function upsertReview(input: {
  lunchId: number;
  reviewerId: ParticipantId;
  rating: number;
  comment: string;
}): Promise<void> {
  const db = getDb();
  // 별점은 0~5, 0.5 단위로 정규화
  const rating = Math.max(0, Math.min(5, Math.round(input.rating * 2) / 2));
  await db.execute({
    sql: `INSERT INTO lunch_reviews (lunch_id, reviewer_id, rating, comment, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(lunch_id, reviewer_id) DO UPDATE SET
            rating = excluded.rating,
            comment = excluded.comment,
            updated_at = datetime('now')`,
    args: [input.lunchId, input.reviewerId, rating, input.comment],
  });
}

export async function deleteReview(lunchId: number, reviewerId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM lunch_reviews WHERE lunch_id = ? AND reviewer_id = ?`,
    args: [lunchId, reviewerId],
  });
}

// 리뷰 평균 (없으면 null → 기존 단일 별점으로 폴백)
export function averageRating(reviews: LunchReview[]): number | null {
  const rated = reviews.filter((r) => r.rating > 0);
  if (rated.length === 0) return null;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
}
