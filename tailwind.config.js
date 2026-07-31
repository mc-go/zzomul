/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          'sans-serif',
        ],
      },
      colors: {
        ink: {
          50: '#f6f6f6',
          100: '#eaeaea',
          200: '#d3d3d3',
          300: '#a8a8a8',
          400: '#7a7a7a',
          500: '#525252',
          600: '#3a3a3a',
          700: '#262626',
          800: '#171717',
          900: '#0a0a0a',
        },
        accent: {
          DEFAULT: '#2f6feb',
          soft: '#e8efff',
        },
        pretzel: {
          DEFAULT: '#a56a3a',
          light: '#c68a55',
          dark: '#7b4a24',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        bake: {
          '0%': { transform: 'scale(0.6) rotate(-20deg)', opacity: '0' },
          '60%': { transform: 'scale(1.1) rotate(6deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // 팝업 팡~ 등장 (살짝 오버슈트 후 안착)
        pop: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '65%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // 컨페티 조각이 중앙에서 사방으로 터져나감 (--dx/--dy/--rot는 인라인 스타일로 주입)
        burst: {
          '0%': { transform: 'translate(0, 0) scale(0.4) rotate(0deg)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': {
            transform: 'translate(var(--dx), var(--dy)) scale(1.2) rotate(var(--rot))',
            opacity: '0',
          },
        },
        // 배경 빵의 수평 흐름: 좌측 화면 밖 → 우측 화면 밖 (위아래 둥실거림은 bob이 담당)
        cloud: {
          '0%': { transform: 'translateX(-12vw)' },
          '100%': { transform: 'translateX(115vw)' },
        },
        // 통통 튀듯 자주 오르내림 — 2초 안팎 주기로 잘 보이게
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' },
          '50%': { transform: 'translateY(-14px) rotate(3deg)' },
        },
        // 페이지 전환 시 아래서 사르륵 올라오는 등장
        rise: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // 별점 클릭 시 통통 튀기
        starpop: {
          '0%': { transform: 'scale(0.5)' },
          '60%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        // 로고 클릭 시 한 바퀴 스핀
        spinonce: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        wiggle: 'wiggle 2.4s ease-in-out infinite',
        float: 'float 2.8s ease-in-out infinite',
        bake: 'bake 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        pop: 'pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        burst: 'burst 1000ms cubic-bezier(0.16, 1, 0.3, 1) both',
        cloud: 'cloud 60s linear infinite',
        bob: 'bob 2.2s ease-in-out infinite',
        // fill 모드 없음 — 끝난 뒤 transform이 남으면 fixed 모달의 기준점이 어긋남
        rise: 'rise 350ms ease-out',
        starpop: 'starpop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        spinonce: 'spinonce 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
