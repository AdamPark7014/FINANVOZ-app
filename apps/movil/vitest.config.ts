import { defineProject } from 'vitest/config';

// Servicios y base en Node (better-sqlite3); los componentes (*.test.tsx) corren con jest-expo.
// plugins/: config plugins de Expo (JS) con su prueba, como en modules/captura-android.
export default defineProject({
  test: { name: 'movil', include: ['src/**/*.test.ts', 'plugins/**/*.test.ts'] },
});
