/** Barril de E13 (deducciones personales e ISR por tarifa) y del cargador de `config/fiscal/<año>.json`. */
export {
  estimarDeducciones,
  type CfdiLeido,
  type CfdiParaDeducir,
  type ConfigDeducciones,
  type DeduccionPorUso,
  type EtiquetaCfdi,
  type MotivoExclusion,
  type ReglaUso,
  type ResultadoDeducciones,
  type TopeDeduccion,
} from './fiscal/deducciones';
export {
  ahorroPorDeducciones,
  isrPorTarifa,
  validarTarifa,
  type FilaTarifa,
  type ResultadoAhorro,
} from './fiscal/isr';
export {
  camposPorDefinir,
  POR_DEFINIR,
  validarConfigFiscal,
  type ConfigFiscal,
  type EstadoConfigFiscal,
  type FilaResico,
} from './fiscal/config';
