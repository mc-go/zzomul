// 사무실 바깥 날씨 — Open-Meteo (무료·API 키 불필요, CORS 허용).
// 사무실 온도 위젯에 곁들이는 용도라 실패하면 조용히 생략. 저장 없음.

export type OfficeWeather = {
  temp: number; // 현재 기온 (°C)
  emoji: string;
  label: string; // 예: "맑음", "비"
};

// 사무실(여의도 코나아이) 좌표 고정 — 사무실이 이전하면 여기만 수정
const OFFICE_LAT = 37.5259;
const OFFICE_LNG = 126.9284;

// WMO 날씨 코드 → 표시용 (Open-Meteo weather_code)
function describeWmo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: '맑음' };
  if (code <= 2) return { emoji: '🌤️', label: '대체로 맑음' };
  if (code === 3) return { emoji: '☁️', label: '흐림' };
  if (code <= 48) return { emoji: '🌫️', label: '안개' };
  if (code <= 57) return { emoji: '🌦️', label: '이슬비' };
  if (code <= 67) return { emoji: '🌧️', label: '비' };
  if (code <= 77) return { emoji: '❄️', label: '눈' };
  if (code <= 82) return { emoji: '🌦️', label: '소나기' };
  if (code <= 86) return { emoji: '🌨️', label: '눈' };
  return { emoji: '⛈️', label: '뇌우' };
}

// 탭을 오갈 때마다 재요청하지 않도록 모듈 캐시 (30분)
let cache: { at: number; value: OfficeWeather | null } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function fetchOfficeWeather(): Promise<OfficeWeather | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${OFFICE_LAT}&longitude=${OFFICE_LNG}` +
      `&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') throw new Error('weather shape');
    const { emoji, label } = describeWmo(code);
    cache = { at: Date.now(), value: { temp, emoji, label } };
  } catch {
    // 실패도 잠시 캐시해서 연속 재시도 방지
    cache = { at: Date.now(), value: null };
  }
  return cache.value;
}
