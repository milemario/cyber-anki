import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: 'github-pages', base: './',
  plugins: [react(), { name: 'pages-nojekyll', closeBundle() { writeFileSync(new URL('./docs/.nojekyll', import.meta.url), ''); } }],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: { __CYBER_API_ORIGIN__: JSON.stringify('https://cyber-anki.milemario.chatgpt.site') },
  build: { outDir: '../docs', emptyOutDir: true },
});
