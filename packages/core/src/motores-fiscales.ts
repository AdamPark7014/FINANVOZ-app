/** Barril de E13 (deducciones personales e ISR por tarifa). */
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
