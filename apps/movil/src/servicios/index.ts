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
  construirVistaWidget,
  ENLACE_WIDGET,
  fijarOcultarMontosWidget,
  obtenerAjustesWidget,
  obtenerVistaWidget,
  type AjustesWidget,
  type VistaWidget,
} from './widget';
export {
  aplicarEleccion,
  confirmarCompraMsi,
  confirmarCuentaDividida,
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
  type PropuestaCompraMsi,
  type PropuestaCuentaDividida,
  type PropuestaMovimiento,
  type ResultadoCola,
  type ResultadoTexto,
  type ResumenMovimiento,
} from './registrar';
export {
  fechaCorta,
  PLANTILLAS_CONSULTA,
  responderConsulta,
  type LineaConsulta,
  type PlantillaConsulta,
  type RespuestaConsulta,
} from './consultas';
export {
  AVISO_SIN_EXPLICACION,
  explicar,
  LLAMADAS_MAXIMAS_EXPLICAR,
  PIE_EXPLICAR,
  type OpcionesExplicar,
  type RespuestaExplicar,
} from './explicar';
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
  confirmarCobertura,
  rechazarCobertura,
  type CoberturaAutomatica,
  type PreguntaCoberturaVista,
} from './cobertura';
export { procesarApertura, type ResultadoApertura } from './apertura';
export { procesarCortes, type CorteCerrado, type EstadoCuentaVista } from './cortes';
export {
  compromisoMsi12Meses,
  EntradaCompraMsi,
  liquidarMsi,
  listarPlanesMsi,
  noEraParaLiquidar,
  pasarAMeses,
  registrarCompraMsi,
  type CompraMsiRegistrada,
  type MesCompromiso,
  type PasadoAMeses,
  type PlanLiquidado,
  type PlanMsiVista,
  type PlanPorLiquidar,
  type PreguntaLiquidar,
} from './msi';
export {
  agregarPagoPlaneado,
  CambiosTarjeta,
  configurarCicloPorVoz,
  corregirSaldoTarjeta,
  editarTarjeta,
  EntradaPagoPlaneado,
  listarPagosPlaneados,
  quitarPagoPlaneado,
  sugerenciaAvalancha,
  type PagoPlaneadoVista,
  type SaldoCorregido,
  type SugerenciaAvalancha,
  type TarjetaEditada,
  type TarjetaPorAgregar,
} from './config-tarjetas';
export {
  detalleTarjeta,
  listarTarjetas,
  pagarTarjeta,
  tarjetaDelDia,
  type DetalleTarjeta,
  type TarjetaDelDia,
  type TarjetaVista,
} from './vista-tarjetas';
export type { CuotaPlan, EstadoCuota, EstadoPlan } from './tarjetas';
export {
  fijarPreferenciasAvisos,
  obtenerPreferenciasAvisos,
  planAvisosTarjetas,
  sincronizarAvisosTarjetas,
  type PreferenciasAvisos,
} from './avisos-tarjetas';
export {
  crearPuertoExpo,
  horaDispositivo,
  puertoEnMemoria,
  type ModuloNotificaciones,
  type PuertoNotificaciones,
} from '../avisos/puerto';
export type { AvisoPlaneado, HorarioSilencioso } from '../avisos/planificar';
export { planAvisoRiesgo, sincronizarAvisoRiesgo } from './aviso-riesgo';
export { PREFIJO_AVISO_RIESGO, type AvisoRiesgo } from '../avisos/riesgo';
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
export {
  obtenerHoy,
  todaviaNoPagoTarjeta,
  type ConceptoReservado,
  type EstadoHoy,
  type TarjetaAccion,
  type VistaHoy,
} from './hoy';
export { marcarAvisoVisto, type Aviso } from './avisos';
export {
  aportarTanda,
  cobrarTanda,
  crearTanda,
  detalleTanda,
  EntradaTanda,
  FRECUENCIAS_TANDA,
  listarTandas,
  proponerTanda,
  reglaDeFrecuencia,
  todaviaNoCobroTanda,
  type DetalleTanda,
  type FrecuenciaTanda,
  type MovimientoTanda,
  type PropuestaTanda,
  type RondaTandaVista,
  type TandaCreada,
  type TandaVista,
  type TandaYaEmpezada,
  type TarjetaTanda,
} from './tandas';
export {
  convertirEnCompromiso,
  listarSuscripciones,
  marcarNoEsSuscripcion,
  procesarSuscripciones,
  procesarSuscripcionesDelDia,
  yaLaCancele,
  type SuscripcionVista,
  type VistaSuscripciones,
} from './suscripciones';
export { crearPersona, fijarApartarDeuda, listarPersonas, registrarPrestamo, type Persona } from './personas';
export {
  MAX_PARTES,
  registrarCuentaDividida,
  repartoCuentaDividida,
  type CuentaDivididaRegistrada,
  type EntradaCuentaDividida,
  type RepartoVista,
} from './cuenta-dividida';
export {
  borrarDatosCobro,
  clabeValida,
  detallePersona,
  fijarRecordatorioCobro,
  formatearCelular,
  formatearClabe,
  guardarDatosCobro,
  leerDatosCobro,
  opcionesRecordatorioCobro,
  prepararCobro,
  sincronizarRecordatoriosCobro,
  type DatosCobro,
  type DetallePersona,
  type OpcionRecordatorio,
  type ResultadoCobro,
} from './cobros';
export { PREFIJO_RECORDATORIO_COBRO } from '../avisos/cobros';
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
export { estadisticasActivas, fijarEstadisticas } from '../privacidad/estadisticas';
export {
  evidenciaPendiente,
  sincronizarEvidencia,
  type PuertoEvidencia,
} from '../privacidad/evidencia-servidor';
export { obtenerCentroPrivacidad, type VistaCentroPrivacidad } from '../privacidad/centro';
export {
  fechaRespaldo,
  fijarContrasenaRespaldo,
  generarRespaldo,
  MENSAJE_NO_ABRE,
  mensajeErrorRespaldo,
  mensajeRestaurado,
  MIN_CONTRASENA_RESPALDO,
  nombreArchivoRespaldo,
  prepararRestauracion,
  restaurarRespaldo,
  resumenRespaldo,
  tieneContrasenaRespaldo,
  validarContrasenaNueva,
  type ArchivosRespaldo,
  type DependenciasRespaldo,
  type ProblemaContrasena,
  type RespaldoListo,
} from './respaldo';
export {
  bajarUltimoRespaldo,
  borrarCuentaRespaldo,
  confirmarCodigoRespaldo,
  DIAS_RESPALDO_AUTOMATICO,
  ejecutarRespaldoAutomatico,
  fijarRespaldoAutomatico,
  mensajeErrorNube,
  motivoRespaldoAutomatico,
  obtenerRespaldoNube,
  planAvisoRespaldo,
  registrarRespaldoRestaurado,
  respaldarEnNube,
  sincronizarAvisoRespaldo,
  type CuentaRespaldo,
  type ErrorCuenta,
  type ErrorRespaldar,
  type ErrorRespaldoNube,
  type ModoCodigo,
  type MotivoSinRespaldo,
  type NubeRespaldo,
  type RespaldoNube,
  type RespaldoRemoto,
  type ResultadoAutomatico,
  type ResultadoRespaldar,
  type TipoRed,
  type VistaRespaldoNube,
} from './respaldo-nube';
export { PREFIJO_AVISO_RESPALDO } from '../avisos/respaldo';
export { bucketLatencia, type EventoAnalitica } from '../analitica/eventos';
export { cargarEscenario, type EscenarioCargado } from './semilla';
export {
  avanzar as avanzarCaptura,
  cuentaEfectivo,
  leerCaptura,
  registrarCaptura,
  UMBRAL_FUE_A_MESES,
  type CapturaEntrante,
  type EstadoCaptura,
  type MotivoRevisar,
  type ResultadoCaptura,
} from './capturas';
export {
  agregarCuentaDesdeCaptura,
  asociarCuentaCaptura,
  confirmarCaptura,
  descartarCaptura,
  fueAMeses,
  listarCapturasPorRevisar,
  marcarNoReconocidaRevisada,
  noReconocidasPorBanco,
  preguntasCaptura,
  responderDuplicado,
  responderPagoSinOrigen,
  responderSalidaSinPareja,
  transaccionesDesdeCapturas,
  type CapturaPorRevisar,
  type CuentaOpcion,
  type MitadCandidata,
  type MotivoPorRevisar,
  type PreguntaCaptura,
  type RespuestaPago,
  type RespuestaSalida,
} from './preguntas-captura';
export {
  aceptarDivulgacionCaptura,
  activarCaptura,
  capturaInactiva,
  desactivarCaptura,
  HORAS_CAPTURA_INACTIVA,
  obtenerEstadoCaptura,
  registrarSenalesCaptura,
  type EstadoCapturaVista,
} from './estado-captura';
export {
  arqueoPendiente,
  calcularArqueo,
  confirmarArqueo,
  efectivoMenosPreciso,
  posponerArqueo,
  prepararArqueo,
  type ArqueoConfirmado,
  type ArqueoPendiente,
  type CalculoArqueo,
  type ConfirmacionArqueo,
  type EntradaArqueo,
  type GastoPorAsignar,
  type PropuestaArqueo,
  type RespuestaSobrante,
  type VistaArqueo,
} from './arqueo';
export {
  ejecutarPorBloques,
  simularPorBloques,
  TAMANO_BLOQUE,
  type OpcionesBloques,
  type SenalCancelacion,
} from './bloques';
export { marcarExtraordinaria } from './historial';
export {
  DIAS_PRUEBA,
  funcionesPlan,
  INTERPRETACIONES_NUBE_MES,
  obtenerPlan,
  sincronizarPlan,
  SIN_PLUS,
  type CodigoLimite,
  type EstadoTienda,
  type FuncionesPlan,
  type Plan,
  type VistaPlan,
} from './plan';
export {
  ETIQUETA_ESTIMACION_INICIAL,
  leerProbabilidadHoy,
  MENSAJE_DATOS_INSUFICIENTES,
  obtenerCalibracion,
  obtenerProbabilidadHoy,
  type VistaCalibracion,
  type VistaProbabilidadHoy,
} from './probabilidad';
export {
  ConsultaMeAlcanza,
  construirVistaMeAlcanza,
  loCompre,
  meAlcanza,
  TEXTO_SIN_TARJETA_PARA_MSI,
  type ComoLoCalcule,
  type CompraElegida,
  type DatosVistaMeAlcanza,
  type NivelRecomendacion,
  type OpcionesLoCompre,
  type ResultadoLoCompre,
  type VistaEscenarioMeAlcanza,
  type VistaMeAlcanza,
} from './me-alcanza';
export {
  contarCfdi,
  importarCfdi,
  resumenImportacion,
  TEXTO_RECHAZO,
  type ArchivoCfdi,
  type MotivoRechazoCfdi,
  type RechazoCfdi,
  type ResultadoImportacion,
} from './cfdi';
export {
  asignarAlumnoNivel,
  AVISO_DEDUCIBLE_EFECTIVO,
  confirmarPagoFactura,
  FORMAS_PAGO_CONFIRMADO,
  guardarPerfilFiscal,
  LEYENDA_ESTIMACION,
  marcarLentes,
  MENSAJE_SIN_PARAMETROS,
  normalizarRfc,
  obtenerDeducciones,
  obtenerPerfilFiscal,
  TEXTO_MOTIVO_EXCLUSION,
  type FacturaVista,
  type FormaPagoConfirmado,
  type PerfilFiscal,
  type TipoDeduccionVista,
  type VistaDeducciones,
} from './deducciones';
