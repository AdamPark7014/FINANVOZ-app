import { defineProject } from 'vitest/config';

// Config plugin (JS). La lógica nativa se prueba en la JVM: `gradle -p nucleo-jvm test`.
export default defineProject({
  test: { name: 'captura-android', include: ['plugin/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
