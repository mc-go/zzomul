// 특정 가게의 먹기록 링크가 어디로 연결되고 좌표/주소를 담고 있는지 확인하는 진단 스크립트.
//   node scripts/inspect-link.mjs 돼지게티
// .env.local의 Turso 접속 정보를 파일에서 직접 읽는다 (토큰 노출 방지).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const query = process.argv[2];
if (!query) {
  console.error('사용법: node scripts/inspect-link.mjs <가게명 일부>');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient({ url: env.VITE_TURSO_URL, authToken: env.VITE_TURSO_TOKEN });

const res = await db.execute({
  sql: `SELECT id, restaurant, link, is_delivery, meal FROM lunches WHERE restaurant LIKE ? ORDER BY id DESC`,
  args: [`%${query}%`],
});
if (res.rows.length === 0) {
  console.log('해당 이름의 기록이 없어요.');
  process.exit(0);
}
for (const row of res.rows) {
  console.log(`#${row.id} ${row.restaurant} (${row.meal}${Number(row.is_delivery) ? '·배달' : ''})`);
  const link = String(row.link ?? '').trim();
  if (!link) {
    console.log('  링크 없음');
    continue;
  }
  console.log(`  링크: ${link}`);
  try {
    const r = await fetch(link, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    });
    const html = await r.text();
    console.log(`  최종 URL: ${r.url} (HTTP ${r.status}, ${html.length} bytes)`);
    // 좌표/주소 흔적 찾기
    const coord =
      html.match(/"(?:latitude|lat)"\s*:\s*"?(3[0-9]\.[0-9]+)"?/) &&
      html.match(/"(?:longitude|lng|lon)"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?/);
    const latM = html.match(/"(?:latitude|lat|y)"\s*:\s*"?(3[0-9]\.[0-9]+)"?/);
    const lngM = html.match(/"(?:longitude|lng|lon|x)"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?/);
    if (latM && lngM) console.log(`  좌표 흔적: lat=${latM[1]}, lng=${lngM[1]}`);
    else console.log('  좌표 흔적 없음');
    const addr = html.match(/(서울|경기|인천)[^"<>\n]{5,60}(로|길|동)\s?[0-9-]+[^"<>\n]{0,20}/);
    if (addr) console.log(`  주소 흔적: ${addr[0]}`);
    else console.log('  주소 흔적 없음');
    void coord;
  } catch (e) {
    console.log(`  요청 실패: ${e?.message ?? e}`);
  }
}
