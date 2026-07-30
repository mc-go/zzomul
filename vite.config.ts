import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages 서브패스 배포용: https://<user>.github.io/zzomul/
// 로컬 개발(`npm run dev`)은 자동으로 base='/'
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zzomul/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
}));
