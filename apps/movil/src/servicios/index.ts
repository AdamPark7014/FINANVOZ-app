/**
 * Casos de uso de la app (`03 §4`). La UI solo importa de aquí (y de `servicios/sesion` al arrancar); nunca de
 * `db/` ni de `@cartera/datos`. Todo es síncrono sobre la base local, salvo borrar todo.
 */
export { crearContexto, enTransaccion, type Contexto, type Reloj } from './contexto';
export { relojDispositivo, relojFijo } from './reloj';
export { crearGeneradorSecuencial, crearGeneradorUuidV7 } from './ids';
export { etiquetaDiaMes, etiquetaFecha } from './formato';
export {
  aceptarConsentimiento,
  obtenerConsentimiento,
  VERSION_CONSENTIMIENTO,
  type EvidenciaConsentimiento,
} from '../privacidad/consentimiento';
export {
  agregarCuenta,
  agregarEfectivo,
  agregarPagoFijo,
  agregarTarjetaCredito,
  configurarIngreso,
  configurarIngresoVariable,
  FRECUENCIAS_INGRESO,
  PAGOS_FIJOS_SUGERIDOS,
  proximoPago,
  type EntradaCuenta,
  type EntradaIngreso,
  type EntradaPagoFijo,
  type EntradaTarjeta,
  type TarjetaCreada,
} from './onboarding';
export {
  colchonSugerido,
  completarOnboarding,
  fijarBloqueo,
  fijarColchon,
  obtenerAjustes,
  obtenerBloqueo,
  onboardingCompletado,
  BLOQUEO_POR_OMISION,
  type PreferenciasBloqueo,
  type VistaAjustes,
} from './ajustes';
export {
  aplicarEleccion,
  confirmarRegistro,
  contarEsperandoConexion,
  descartarPorInterpretar,
  listarPorInterpretar,
  procesarPorInterpretar,
  registrarTexto,
  registrarTextoLocal,
  revisarPorInterpretar,
  TOPE_OPTIMISTA,
  type AccionElegir,
  type CuentaPorElegir,
  type Eleccion,
  type FrasePorInterpretar,
  type MotivoNoSoportado,
  type MotivoPorInterpretar,
  type OpcionesTexto,
  type OrigenDictado,
  type PropuestaMovimiento,
  type ResultadoCola,
  type ResultadoTexto,
  type ResumenMovimiento,
  type VistaConsulta,
} from './registrar';
export { contextoNube, type Conectividad, type NivelNube } from './nube';
export {
  aplicarCorreccion,
  historialMovimiento,
  type CambiosResueltos,
  type CompromisoConfigurado,
  type ResumenTransaccion,
  type VersionAnterior,
} from './correcciones';
export { deshacer } from './deshacer';
export {
  anularMovimiento,
  EntradaMovimiento,
  registrarMovimiento,
  type MovimientoRegistrado,
  type OrigenRegistro,
} from './formulario';
export {
  confirmarIngresoRecibido,
  cubrirConMovimiento,
  listarOcurrencias,
  materializarOcurrencias,
  omitirOcurrencia,
  todaviaNo,
  yaLaPague,
  type OcurrenciaVista,
  type RefOcurrencia,
} from './ocurrencias';
export { obtenerHoy, type ConceptoReservado, type EstadoHoy, type TarjetaAccion, type VistaHoy } from './hoy';
export { marcarAvisoVisto, type Aviso } from './avisos';
export { crearPersona, fijarApartarDeuda, listarPersonas, registrarPrestamo, type Persona } from './personas';
export {
  listarCategorias,
  listarCuentas,
  type CompromisoProximo,
  type CuentaDebes,
  type CuentaTienes,
  type PersonaTeDebe,
  type VistaCuentas,
} from './cuentas';
export {
  listarMovimientos,
  type DiaMovimientos,
  type FiltroMovimientos,
  type Insignia,
  type MovimientoVista,
} from './movimientos';
export { exportarCsv, exportarJson } from '../privacidad/exportar';
export { cargarEscenario, type EscenarioCargado } from './semilla';
