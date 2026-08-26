// 코드에서 더 이상 쓰지 않는 레거시 컬럼 정리 (1회성).
//   node scripts/drop-legacy-columns.mjs          # 남은 데이터 확인만
//   node scripts/drop-legacy-columns.mjs --apply  # 실제 DROP COLUMN 실행
// 대상:
//   lunches.comment            — 참여자별 평(lunch_reviews)으로 대체, UI 표시 없음
//   users.status_message/date  — daily_statuses로 대체 (백필 마이그레이션 완료)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');

const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient({ url: env.VITE_TURSO_URL, authToken: env.VITE_TURSO_TOKEN });

// 지우기 전에 남은 데이터를 보여준다 (삭제되면 복구 불가)
const comments = await db.execute(
  `SELECT id, restaurant, comment FROM lunches WHERE comment != ''`,
);
console.log(`lunches.comment 값이 남은 기록: ${comments.rows.length}건`);
for (const r of comments.rows) console.log(`  #${r.id} ${r.restaurant}: "${r.comment}"`);

const statuses = await db.execute(
  `SELECT id, emp_no, status_date, status_message FROM users WHERE status_message != ''`,
);
console.log(`users.status_message 값이 남은 프로필: ${statuses.rows.length}건`);
for (const r of statuses.rows) {
  console.log(`  ${r.emp_no} (${r.status_date}): "${r.status_message}"`);
}
// daily_statuses에 백필됐는지 교차 확인
for (const r of statuses.rows) {
  const dup = await db.execute({
    sql: `SELECT 1 FROM daily_statuses WHERE emp_no = ? AND date = ?`,
    args: [String(r.emp_no), String(r.status_date ?? '')],
  });
  if (dup.rows.length === 0) {
    console.log(`  ⚠ ${r.emp_no} ${r.status_date} 는 daily_statuses에 없음 — 백필 후 삭제 권장`);
  }
}

if (!apply) {
  console.log('\n확인 모드 — 실제 삭제는 --apply로 실행하세요.');
  process.exit(0);
}

for (const sql of [
  `ALTER TABLE lunches DROP COLUMN comment`,
  `ALTER TABLE users DROP COLUMN status_message`,
  `ALTER TABLE users DROP COLUMN status_date`,
]) {
  try {
    await db.execute(sql);
    console.log(`OK: ${sql}`);
  } catch (e) {
    console.log(`실패(이미 삭제됐을 수 있음): ${sql} — ${e?.message ?? e}`);
  }
}
console.log('완료');
