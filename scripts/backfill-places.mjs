// 네이버지도 링크가 있는 다녀온(done) 기록에서 좌표를 뽑아 places에 백필하는 1회성 스크립트.
//   node scripts/backfill-places.mjs          # 실제 저장
//   node scripts/backfill-places.mjs --dry    # 저장 없이 결과만 출력
// .env.local의 VITE_TURSO_URL/TOKEN을 직접 읽는다 (토큰을 명령줄에 노출하지 않기 위함).
// 좌표를 못 찾은 가게는 그냥 건너뜀 (지도에서 생략되는 것과 동일한 정책).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@libsql/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');

// .env.local 파싱 (KEY=VALUE 한 줄씩)
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.VITE_TURSO_URL || !env.VITE_TURSO_TOKEN) {
  console.error('.env.local에 VITE_TURSO_URL/TOKEN이 없어요.');
  process.exit(1);
}

const db = createClient({ url: env.VITE_TURSO_URL, authToken: env.VITE_TURSO_TOKEN });

// 앱의 normalizeRestaurant와 동일한 규칙 (src/lib/lunch-stats.ts)
const normalize = (name) => name.replace(/\s+/g, '').toLowerCase();

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    redirect: 'follow',
  });
  return { finalUrl: res.url, text: await res.text(), status: res.status };
}

// URL 문자열 자체에서 좌표 파라미터 읽기 (lat/lng= 또는 구형 c=lng,lat)
function coordsFromUrl(u) {
  const lat = u.match(/[?&]lat=(3[0-9]\.[0-9]+)/);
  const lng = u.match(/[?&]lng=(1[0-9]{2}\.[0-9]+)/);
  if (lat && lng) return { lat: parseFloat(lat[1]), lng: parseFloat(lng[1]), via: 'url lat/lng=' };
  const c = u.match(/[?&]c=(1[0-9]{2}\.[0-9]+),(3[0-9]\.[0-9]+)/);
  if (c) return { lat: parseFloat(c[2]), lng: parseFloat(c[1]), via: 'url c=' };
  return null;
}

// 네이버 장소 페이지/URL에서 좌표(lat, lng) 추출 시도 — 실패하면 null
async function resolveNaver(link) {
  // 0) 원본 링크에 좌표가 그대로 있는 경우 (리다이렉트 전에 먼저 확인)
  const direct = coordsFromUrl(link);
  if (direct) return direct;
  const { finalUrl, text } = await fetchText(link);
  const fromFinal = coordsFromUrl(finalUrl);
  if (fromFinal) return fromFinal;
  // 1) 장소 ID를 찾아 모바일 플레이스 페이지에서 좌표 파싱
  //    (naver.me 단축링크는 appLink.naver?pinId=... 로 풀림)
  const urls = `${link} ${finalUrl}`;
  const idMatch =
    urls.match(/(?:place|restaurant)\/(\d+)/) ??
    urls.match(/[?&](?:pinId|id)=(\d+)/) ??
    text.match(/(?:place|restaurant)\/(\d+)/);
  if (idMatch) {
    const id = idMatch[1];
    for (const kind of ['restaurant', 'place']) {
      try {
        const page = await fetchText(`https://m.place.naver.com/${kind}/${id}/home`);
        const coord =
          page.text.match(/"y"\s*:\s*"?(3[0-9]\.[0-9]+)"?\s*,\s*"x"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?/) ??
          page.text.match(/"x"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?\s*,\s*"y"\s*:\s*"?(3[0-9]\.[0-9]+)"?/);
        if (coord) {
          // 매치 순서에 따라 lat/lng 자리 구분
          const a = parseFloat(coord[1]);
          const b = parseFloat(coord[2]);
          return a > 90 ? { lat: b, lng: a, via: `${kind}/${id}` } : { lat: a, lng: b, via: `${kind}/${id}` };
        }
      } catch {
        // 다음 방법 시도
      }
    }
  }
  console.log(`    (최종 URL: ${finalUrl})`);
  return null;
}

const lunches = await db.execute(
  `SELECT restaurant, link FROM lunches WHERE status = 'done' AND link != ''`,
);
const placed = new Set(
  (await db.execute(`SELECT name_key FROM places`)).rows.map((r) => String(r.name_key)),
);

// 가게별 첫 네이버 링크만 사용
const targets = new Map();
for (const row of lunches.rows) {
  const name = String(row.restaurant ?? '').trim();
  const link = String(row.link ?? '').trim();
  const key = normalize(name);
  if (!name || !key || placed.has(key) || targets.has(key)) continue;
  if (!/naver\.(me|com)/.test(link)) continue;
  targets.set(key, { name, link });
}

console.log(`네이버 링크가 있고 아직 핀이 없는 가게: ${targets.size}곳${dry ? ' (dry run)' : ''}`);
let ok = 0;
for (const [key, t] of targets) {
  try {
    const coord = await resolveNaver(t.link);
    if (!coord) {
      console.log(`  ✗ ${t.name} — 좌표를 못 찾음 (${t.link})`);
      continue;
    }
    console.log(`  ✓ ${t.name} → ${coord.lat}, ${coord.lng} (${coord.via})`);
    if (!dry) {
      await db.execute({
        sql: `INSERT INTO places (name_key, name, lat, lng, updated_at)
              VALUES (?, ?, ?, ?, datetime('now'))
              ON CONFLICT(name_key) DO UPDATE SET
                name = excluded.name, lat = excluded.lat, lng = excluded.lng,
                updated_at = datetime('now')`,
        args: [key, t.name, coord.lat, coord.lng],
      });
    }
    ok += 1;
  } catch (e) {
    console.log(`  ✗ ${t.name} — 실패: ${e?.message ?? e}`);
  }
}
console.log(`완료: ${ok}/${targets.size}곳 ${dry ? '해석됨' : '저장됨'}`);
