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
export { callarVoz, decirEnVoz, fraseRespuestaVoz } from './respuesta';
export { BotonDictarCampo, PISTA_DICTAR_CAMPO } from './BotonDictarCampo';
export { ProveedorDictadoCampos } from './ProveedorDictadoCampos';
