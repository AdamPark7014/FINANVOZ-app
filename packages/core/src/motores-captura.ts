/** Barril de E9 (comercios y deduplicación), del motor de captura (`docs/07-CAPTURA.md §3 y §6`) y de E14 (suscripciones). */
export { jaro, jaroWinkler, normalizarComercio, similitud } from './comercios';
export {
  CUENTA_POR_ASIGNAR,
  CUENTA_POR_ASIGNAR_ENTRADAS,
  decidirDuplicado,
  elegirMovimiento,
  emparejarTransferencias,
  type CandidatoElegido,
  type CapturaDedup,
  type CapturaTransferencia,
  type Decision,
  type Espacio,
  type MovimientoDedup,
  type MovimientoTransferencia,
  type ParTransferencia,
  type ResultadoDuplicado,
  type Sentido,
  type TipoCapturaTransferencia,
} from './deduplicacion';
export {
  bancoDePaquete,
  CAMPOS_PLANTILLA,
  compilarPlantillas,
  interpretarNotificacion,
  parsearMonto,
  TIPOS_PLANTILLA,
  type BancoPlantillas,
  type CampoPlantilla,
  type CatalogoPlantillas,
  type Interpretacion,
  type NotificacionEntrante,
  type Plantilla,
  type PlantillaCompilada,
  type TipoPlantilla,
} from './captura/plantillas';
export {
  CATALOGO_SEMILLA,
  categorizarComercio,
  construirCatalogo,
  type EntradaCatalogo,
  type ReglasComercio,
  type ResultadoCategoria,
} from './captura/categorizar';
export {
  CATALOGO_SUSCRIPCIONES,
  detectarSuscripciones,
  resumenActivas,
  VENTANA_SUSCRIPCIONES_DIAS,
  type GastoSuscripcion,
  type Periodicidad,
  type ResumenSuscripciones,
  type Suscripcion,
} from './suscripciones';
