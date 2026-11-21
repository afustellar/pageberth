import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: 5178, strictPort: true, watch: { ignored: ['**/release/**', '**/dist/**', '**/build/**'] } },
  build: { outDir: 'dist', target: 'es2020' }
})
