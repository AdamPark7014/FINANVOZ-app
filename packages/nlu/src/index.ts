export * from './esquema';
export type { ContextoInterprete, CuentaContexto } from './contexto';
export { normalizarAlias } from './normalizar';
export {
  resolverCuenta,
  UMBRAL_ALIAS_DIFUSO,
  type CuentaResolutor,
  type RefResolutor,
  type ResultadoResolutor,
  type TipoCuenta,
} from './resolutor';
export { interpretarReglas } from './reglas';
export { compararInterpretacion } from './eval/comparar';
