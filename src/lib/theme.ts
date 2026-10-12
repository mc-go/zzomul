import { useEffect, useState } from 'react';

// 테마: 기본(쪼물 — 크림·프레첼) / 모노(화이트앤블랙 무채색)
// 색 값 자체는 tailwind.config.js의 CSS 변수가 담당하고, 여기선 <html data-theme>만 바꿈.
// 브라우저별 localStorage에 기억 (첫 페인트 깜빡임 방지용 초기 적용은 index.html 인라인 스크립트)

export type Theme = 'default' | 'mono';

export const THEME_STORAGE_KEY = 'zzomul.theme.v1';
const THEME_EVENT = 'zzomul:theme';

// 주소창/상태바 색 (index.html의 theme-color 메타)
const META_COLORS: Record<Theme, string> = { default: '#fdfaf3', mono: '#ffffff' };

export function getTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'mono' ? 'mono' : 'default';
  } catch {
    return 'default';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'mono') root.dataset.theme = 'mono';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장 실패(사생활 보호 모드 등)해도 이번 세션엔 적용
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setState] = useState<Theme>(getTheme);
  useEffect(() => {
    const sync = () => setState(getTheme());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return [theme, setTheme];
}
