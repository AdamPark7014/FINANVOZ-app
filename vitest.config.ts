import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/calculadora', 'apps/movil', 'services/proxy', 'modules/captura-android'],
  },
});
