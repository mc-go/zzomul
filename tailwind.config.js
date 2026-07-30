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
      },
      animation: {
        wiggle: 'wiggle 2.4s ease-in-out infinite',
        float: 'float 2.8s ease-in-out infinite',
        bake: 'bake 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
