/**
 * Escenarios semilla para el menú oculto de desarrollo de Ajustes (`fixtures/README.md`; solo `__DEV__`).
 * Se cargan con `require` perezoso: el JSON se lee solo al elegirlo. `e-negocio` llega con M11.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- JSON de fixtures empaquetado por Metro */
export const ESCENARIOS_DEV: readonly { id: string; cargar: () => unknown }[] = [
  { id: 'e4-01', cargar: () => require('../../../../../fixtures/escenarios/e4-01.json') },
  { id: 'e5-10', cargar: () => require('../../../../../fixtures/escenarios/e5-10.json') },
  { id: 'e-captura', cargar: () => require('../../../../../fixtures/escenarios/e-captura.json') },
];
