import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        aviso: fileURLToPath(new URL('./aviso-de-privacidad.html', import.meta.url)),
      },
    },
  },
  test: { name: 'calculadora', environment: 'jsdom' },
});
