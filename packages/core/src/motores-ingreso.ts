// E3 · Ingresos, horizonte y compromisos
export { fechasEfectivas, fechasNominales, proximasFechas, type Ajuste, type Regla } from './recurrencia';
export {
  DIAS_HORIZONTE_FIJO,
  expandirProgramados,
  horizonte,
  type EstadoHorizonte,
  type Horizonte,
  type Ocurrencia,
  type Programado,
} from './horizonte';
export {
  cubreOcurrencia,
  elegirOcurrencia,
  UMBRAL_SIMILITUD_COMERCIO,
  VENTANA_EGRESO,
  VENTANA_INGRESO_ANTES,
  VENTANA_INGRESO_DESPUES,
  type DecisionCobertura,
  type MovimientoCobertura,
  type OcurrenciaCobertura,
  type SimilitudComercio,
} from './cobertura';
// E4 · Dinero libre y "hoy puedes gastar"
export {
  dineroLibre,
  puedesRetirar,
  type CuotaMsiLibre,
  type DesgloseReservado,
  type DeudaPersonaLibre,
  type EntradaLibre,
  type ResultadoLibre,
  type TarjetaLibre,
} from './libre';
