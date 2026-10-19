export { useDictado, IDIOMA_DICTADO, type Dictado, type OpcionesDictado } from './useDictado';
export { MENSAJES_DICTADO, type ErrorDictado, type EstadoDictado, type EstadoGrabacion } from './estado';
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
export { callarVoz, decirEnVoz, fraseRespuestaVoz } from './respuesta';
