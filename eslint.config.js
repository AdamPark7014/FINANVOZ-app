import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'fixtures/**',
      'docs/**',
      'apps/movil/.expo/**',
      'apps/movil/android/**',
      'apps/movil/expo-env.d.ts',
      'modules/captura-android/android/**',
      'modules/captura-android/nucleo-jvm/**',
    ],
  },
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
    // packages/respaldo corre en el teléfono: la criptografía llega inyectada; node:crypto solo en ./node y pruebas.
    files: ['packages/respaldo/src/**/*.ts'],
    ignores: ['packages/respaldo/src/node.ts', 'packages/respaldo/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^node:', message: 'La criptografía se inyecta (03 §4); Node solo en ./node.' },
          ],
        },
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
    files: ['apps/movil/{app,src}/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // La UI pasa por servicios/ (03 §4): ni la base ni el repositorio se importan desde pantallas o componentes.
    files: ['apps/movil/app/**/*.{ts,tsx}', 'apps/movil/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@cartera/datos', '**/db/**', '**/src/db'],
              message: 'La UI pasa por servicios/ (03 §4).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/movil/*.config.js', 'apps/movil/babel.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['modules/captura-android/app.plugin.js', 'modules/captura-android/plugin/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['services/proxy/supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  },
);
