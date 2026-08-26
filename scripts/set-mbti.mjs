// 멤버 MBTI 초기값을 settings(mbti.{참여자ID})에 저장하는 1회성 스크립트.
//   node scripts/set-mbti.mjs
// 사번은 users 테이블의 이름으로 찾고, 퇴사자(박소현)는 EXTRA ID로 직접 저장.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient({ url: env.VITE_TURSO_URL, authToken: env.VITE_TURSO_TOKEN });

await db.execute(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const BY_NAME = { 윤소정: 'ISFJ', 고민채: 'INFP', 신아람: 'ESFJ' };
const DIRECT = { ex_sohyun: 'INTP' }; // 박소현

async function save(pid, mbti, label) {
  await db.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    args: [`mbti.${pid}`, mbti],
  });
  console.log(`  ✓ ${label} (${pid}) → ${mbti}`);
}

const users = await db.execute(`SELECT emp_no, name FROM users WHERE emp_no != ''`);
const found = new Set();
for (const row of users.rows) {
  const name = String(row.name ?? '').trim();
  const mbti = BY_NAME[name];
  if (!mbti) continue;
  await save(String(row.emp_no), mbti, name);
  found.add(name);
}
for (const name of Object.keys(BY_NAME)) {
  if (!found.has(name)) console.log(`  ⚠ users 테이블에서 '${name}'을 못 찾음 — 건너뜀`);
}
for (const [pid, mbti] of Object.entries(DIRECT)) {
  await save(pid, mbti, '박소현');
}
console.log('완료');
