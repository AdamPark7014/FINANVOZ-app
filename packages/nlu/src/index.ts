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
export { interpretarMonto, type MontoDictado } from './reglas/monto-dictado';
export {
  interpretarPaso,
  lecturaDesdeInterpretacion,
  EsquemaLecturaPaso,
  INSTITUCIONES,
  PASOS,
  FRECUENCIAS_INGRESO,
  FRECUENCIAS_PAGO,
  FRECUENCIAS_TANDA,
  SUBTIPOS_CUENTA,
  type Cifra,
  type ContextoPaso,
  type Institucion,
  type LecturaDe,
  type LecturaPaso,
  type Paso,
} from './pasos';
export type { LecturaMonto } from './reglas/montos';
export {
  leerConfirmacion,
  EsquemaLecturaConfirmacion,
  FILAS_CONFIRMABLES,
  type CambioConfirmacion,
  type ContextoConfirmacion,
  type FilaConfirmable,
  type LecturaConfirmacion,
} from './pasos/confirmacion';
export {
  sugerirReparacion,
  MAX_OPCIONES_REPARACION,
  TIPOS_REPARACION,
  type OpcionReparacion,
  type TipoReparacion,
} from './pasos/reparacion';
export { compararInterpretacion } from './eval/comparar';
export * from './cliente';
export * from './explicar';
