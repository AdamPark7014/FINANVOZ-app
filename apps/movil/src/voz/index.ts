export {
  useDictado,
  IDIOMA_DICTADO,
  type Dictado,
  type OpcionesDictado,
  type OpcionesInicio,
} from './useDictado';
export { ProveedorDictado, useDictador, type Dictador, type LectorMonto } from './ProveedorDictado';
export {
  abrirAjustesDictado,
  useMicrofono,
  type MensajesDictado,
  type Microfono,
  type OpcionesMicrofono,
} from './useMicrofono';
export {
  MENSAJES_DICTADO,
  type ClaveMensajeDictado,
  type ErrorDictado,
  type EstadoDictado,
  type EstadoGrabacion,
} from './estado';
export type { EventoMotor, MotorDictado, OpcionesMotor } from './motor';
export { motorExpo } from './motor-expo';
export {
  useBotonHablar,
  REBOTE_MS,
  UMBRAL_MANTENER_MS,
  type BotonHablar,
  type ControlHablar,
} from './useBotonHablar';
export * from './textos';
export {
  callarVoz,
  configurarVoz,
  configuracionVoz,
  decirEnVoz,
  decirTurno,
  estaHablando,
  fraseRespuestaVoz,
  hablar,
  suscribirHabla,
  CONFIG_VOZ_INICIAL,
  type ConfigVoz,
  type FinHabla,
  type OpcionesHabla,
} from './respuesta';
export { fraseHablada, type DatosHablados, type TurnoHablable } from '../servicios/voz-respuesta';
export {
  useVozAsistente,
  useHablando,
  useReducirMovimiento,
  CORTAR_VOZ_AL_TOCAR,
  type VozAsistente,
} from './useVozAsistente';
export { IndicadorVoz } from './IndicadorVoz';
export { senalEscucha, type SenalEscucha } from './senales';
export {
  elegirVoz,
  faltaVozMejorada,
  opcionesVoz,
  parametrosVoz,
  type CalidadVoz,
  type OpcionVoz,
  type VozSistema,
} from './voces';
export { cargarVoces, hayInternet } from './catalogo';
export { BotonDictarCampo } from './BotonDictarCampo';
