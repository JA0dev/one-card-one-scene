import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // 첫 화면 묶음은 gzip 약 190KB(React·Radix·dnd-kit·Supabase). Word 내보내기(docx)는 따로 불러온다.
  build: { outDir: 'out', rollupOptions: { input: 'index.html' }, chunkSizeWarningLimit: 700 },
});
