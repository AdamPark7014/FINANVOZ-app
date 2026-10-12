/**
 * Contrato del reconocedor de voz. La app usa `motorExpo` (expo-speech-recognition); las pruebas
 * inyectan un motor falso. Ningún evento ni texto dictado se registra en logs (regla 9).
 */

export interface OpcionesMotor {
  /** Siempre `es-MX` en v1. */
  idioma: string;
  /** Transcripción en vivo mientras se habla. */
  resultadosParciales: boolean;
  /** Reconocer en el teléfono, sin enviar audio a un servicio en línea. */
  enDispositivo: boolean;
}

/** Códigos crudos del reconocedor (los del Web Speech API que expone expo-speech-recognition). */
export type CodigoErrorMotor =
  | 'aborted'
  | 'audio-capture'
  | 'interrupted'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'busy'
  | 'client'
  | 'speech-timeout'
  | 'unknown';

export type EventoMotor =
  | { tipo: 'inicio' }
  | { tipo: 'resultado'; texto: string; final: boolean }
  | { tipo: 'sin_coincidencia' }
  | { tipo: 'error'; codigo: CodigoErrorMotor }
  | { tipo: 'fin' };

export interface MotorDictado {
  /** `false` si el teléfono no tiene servicio de reconocimiento. */
  disponible(): boolean;
  /** `true` si el teléfono puede reconocer es-MX sin red. */
  soportaEnDispositivo(): boolean;
  /** Pide micrófono y reconocimiento; `true` si quedaron concedidos. */
  solicitarPermiso(): Promise<boolean>;
  iniciar(opciones: OpcionesMotor): void;
  /** Deja de escuchar y entrega el resultado final. */
  detener(): void;
  /** Descarta lo escuchado. */
  abortar(): void;
  /** Devuelve la función para cancelar la suscripción. */
  suscribir(alEvento: (evento: EventoMotor) => void): () => void;
}
