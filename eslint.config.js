import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'fixtures/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // packages/core: motores puros. Sin reloj, sin aleatoriedad, sin dependencias en tiempo de ejecución.
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/**/*.test.ts', 'packages/core/src/__pruebas__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^(?!\\.{1,2}/)', message: 'packages/core no importa nada fuera de sí mismo.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Los motores reciben `hoy` (regla 5).' },
        { object: 'Math', property: 'random', message: 'Los motores reciben `semilla` (regla 5).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Usa fechas civiles de core/fecha (regla 6).' },
      ],
    },
  },
  {
    files: ['apps/calculadora/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['services/proxy/supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  },
);
