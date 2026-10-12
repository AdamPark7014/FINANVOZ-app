import { defineProject } from 'vitest/config';

// Servicios y base en Node (better-sqlite3); los componentes (*.test.tsx) corren con jest-expo.
export default defineProject({ test: { name: 'movil', include: ['src/**/*.test.ts'] } });
