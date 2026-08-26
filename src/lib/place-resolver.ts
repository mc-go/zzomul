// 네이버지도 링크 → 좌표 자동 해석 (베스트 에포트).
// 지도 탭에 들어올 때 핀 없는 가게의 최신 먹기록 링크를 훑어서 자동으로 핀을 만든다.
//  - URL 문자열에 lat/lng= 또는 c= 좌표가 있으면 네트워크 없이 바로 파싱
//  - naver.me 단축링크 등은 브라우저가 네이버를 직접 못 읽어서(CORS)
//    공개 프록시(allorigins)를 거쳐 장소 ID → 모바일 플레이스 페이지에서 좌표를 긁는다
// 실패하면 null — 지도에서 그냥 생략되고, 수동 핀 지정(칩 클릭)으로 언제든 보완 가능.
// 같은 로직의 로컬 스크립트 버전: scripts/backfill-places.mjs (프록시 없이 직접 fetch라 더 안정적)

export type ResolvedCoord = { lat: number; lng: number };

// 세션 동안 이미 시도한 링크는 다시 안 건드림 (탭을 오갈 때마다 프록시를 두드리지 않게)
const attempted = new Set<string>();

export function isNaverLink(link: string): boolean {
  return /naver\.(me|com)/.test(link);
}

// URL 문자열 자체에서 좌표 파라미터 읽기 (lat/lng= 또는 구형 c=lng,lat)
export function coordsFromUrl(url: string): ResolvedCoord | null {
  const lat = url.match(/[?&]lat=(3[0-9]\.[0-9]+)/);
  const lng = url.match(/[?&]lng=(1[0-9]{2}\.[0-9]+)/);
  if (lat && lng) return { lat: parseFloat(lat[1]), lng: parseFloat(lng[1]) };
  const c = url.match(/[?&]c=(1[0-9]{2}\.[0-9]+),(3[0-9]\.[0-9]+)/);
  if (c) return { lat: parseFloat(c[2]), lng: parseFloat(c[1]) };
  return null;
}

// 공개 CORS 프록시 — 첫 번째가 죽거나 막히면 다음 것으로 폴백
const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

async function fetchViaProxy(url: string): Promise<string | null> {
  for (const makeUrl of PROXIES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(makeUrl(url), { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (text) return text;
    } catch {
      // 다음 프록시로
    }
  }
  return null;
}

function idFromText(text: string): string | null {
  const m =
    text.match(/(?:place|restaurant)\/(\d{5,})/) ?? text.match(/[?&](?:pinId|id)=(\d{5,})/);
  return m ? m[1] : null;
}

function coordsFromPlaceHtml(html: string): ResolvedCoord | null {
  const yx = html.match(/"y"\s*:\s*"?(3[0-9]\.[0-9]+)"?\s*,\s*"x"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?/);
  if (yx) return { lat: parseFloat(yx[1]), lng: parseFloat(yx[2]) };
  const xy = html.match(/"x"\s*:\s*"?(1[0-9]{2}\.[0-9]+)"?\s*,\s*"y"\s*:\s*"?(3[0-9]\.[0-9]+)"?/);
  if (xy) return { lat: parseFloat(xy[2]), lng: parseFloat(xy[1]) };
  return null;
}

// 링크 하나를 좌표로 해석 — 실패하면 null (이 세션에서 재시도 안 함)
export async function resolveNaverLink(link: string): Promise<ResolvedCoord | null> {
  const direct = coordsFromUrl(link);
  if (direct) return direct;
  if (!isNaverLink(link) || attempted.has(link)) return null;
  attempted.add(link);
  // 장소 ID 찾기: 링크 자체 → (단축링크면) 프록시로 풀어본 페이지 본문
  let id = idFromText(link);
  if (!id) {
    const html = await fetchViaProxy(link);
    if (html) id = idFromText(html);
  }
  if (!id) return null;
  for (const kind of ['restaurant', 'place']) {
    const html = await fetchViaProxy(`https://m.place.naver.com/${kind}/${id}/home`);
    if (!html) continue;
    const coord = coordsFromPlaceHtml(html);
    if (coord) return coord;
  }
  return null;
}
