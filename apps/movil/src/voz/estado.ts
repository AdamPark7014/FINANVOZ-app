import type { CodigoErrorMotor } from './motor';

export type EstadoGrabacion = 'inactivo' | 'escuchando' | 'procesando' | 'error' | 'sin_permiso';

export type ErrorDictado = 'no_disponible' | 'sin_voz' | 'red' | 'ocupado' | 'audio' | 'desconocido';

export interface EstadoDictado {
  estado: EstadoGrabacion;
  /** Transcripción en vivo (resultados parciales). */
  parcial: string;
  /** Transcripción final del último dictado; `null` mientras no hay. */
  transcripcion: string | null;
  error: ErrorDictado | null;
}

export type AccionDictado =
  | { tipo: 'escuchar' }
  | { tipo: 'parcial'; texto: string }
  | { tipo: 'final'; texto: string }
  | { tipo: 'detener' }
  | { tipo: 'fin' }
  | { tipo: 'cancelar' }
  | { tipo: 'sin_permiso' }
  | { tipo: 'error'; error: ErrorDictado };

export const ESTADO_INICIAL: EstadoDictado = {
  estado: 'inactivo',
  parcial: '',
  transcripcion: null,
  error: null,
};

const activo = (e: EstadoGrabacion) => e === 'escuchando' || e === 'procesando';

/** Máquina de estados del dictado; pura para probarla sin el módulo nativo. */
export function reducirDictado(s: EstadoDictado, a: AccionDictado): EstadoDictado {
  switch (a.tipo) {
    case 'escuchar':
      return { estado: 'escuchando', parcial: '', transcripcion: null, error: null };
    case 'parcial':
      return activo(s.estado) ? { ...s, parcial: a.texto } : s;
    case 'final': {
      if (!activo(s.estado)) return s;
      const texto = a.texto.trim();
      return texto === ''
        ? { ...s, estado: 'error', error: 'sin_voz' }
        : { estado: 'inactivo', parcial: '', transcripcion: texto, error: null };
    }
    case 'detener':
      return s.estado === 'escuchando' ? { ...s, estado: 'procesando' } : s;
    case 'fin': {
      // Terminó sin resultado final: se usa lo último parcial si lo hay.
      if (!activo(s.estado)) return s;
      return reducirDictado(s, { tipo: 'final', texto: s.parcial });
    }
    case 'cancelar':
      return activo(s.estado) ? { ...ESTADO_INICIAL } : s;
    case 'sin_permiso':
      return { ...ESTADO_INICIAL, estado: 'sin_permiso' };
    case 'error':
      return { ...s, estado: 'error', parcial: '', error: a.error };
  }
}

/** Traduce el código del reconocedor; `null` = no es un error para la persona (cancelado). */
export function clasificarErrorMotor(codigo: CodigoErrorMotor): ErrorDictado | 'sin_permiso' | null {
  switch (codigo) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'sin_permiso';
    case 'no-speech':
    case 'speech-timeout':
      return 'sin_voz';
    case 'network':
      return 'red';
    case 'busy':
      return 'ocupado';
    case 'audio-capture':
    case 'interrupted':
      return 'audio';
    case 'language-not-supported':
    case 'service-not-allowed':
      return 'no_disponible';
    default:
      return 'desconocido';
  }
}

/** Copy para la UI (02-UX §14: qué pasó + qué hacer; la voz nunca es la única vía). */
export const MENSAJES_DICTADO: Record<ErrorDictado | 'sin_permiso', string> = {
  sin_permiso: 'Para dictar, permite el micrófono en los ajustes del teléfono. También puedes escribirlo.',
  no_disponible: 'Tu teléfono no tiene dictado disponible. Escríbelo y lo registro igual.',
  sin_voz: 'No te escuché. Toca para hablar y di tu gasto, o escríbelo.',
  red: 'El dictado necesita internet en este teléfono. Escríbelo o inténtalo de nuevo.',
  ocupado: 'El micrófono está ocupado. Intenta de nuevo en un momento.',
  audio: 'No pude usar el micrófono. Intenta de nuevo o escríbelo.',
  desconocido: 'Algo falló con el dictado. Intenta de nuevo o escríbelo.',
};
