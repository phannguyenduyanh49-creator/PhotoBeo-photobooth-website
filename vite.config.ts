import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  cacheDir: '.cache/vite',
  plugins: [react({ exclude: [/node_modules/, /\.cache[\\/]/] }), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' }, watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**', '**/.data/**', '**/.test-data/**', '**/.cache/**'] } },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
