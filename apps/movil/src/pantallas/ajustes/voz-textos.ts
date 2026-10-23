import type { VelocidadVoz } from '../../servicios/preferencias';
import { segunPlataforma } from './plataforma';

/** Redacción Ajustes › Voz (`02 §14`): tuteo, sin tecnicismos ni exclamaciones. */

export const SECCION_VOZ = 'Voz';

export const ETIQUETA_CONTESTAR_EN_VOZ = 'Contestarte en voz';

export const DESC_CONTESTAR_EN_VOZ =
  'Cuando me hablas, te contesto en voz alta: lo que registré, lo que necesito saber y cuánto te queda hoy.';

/** Con TalkBack encendido no hablo encima del lector (lo anuncia el aviso). */
export const PISTA_CONTESTAR_EN_VOZ = 'Con TalkBack encendido no hablo; el lector te lo anuncia.';
/** En iPhone el lector es VoiceOver (`voz/respuesta.ts` revisa cualquier lector de pantalla). */
export const PISTA_CONTESTAR_EN_VOZ_IOS = 'Con VoiceOver encendido no hablo; el lector te lo anuncia.';

export function pistaContestarEnVoz(os?: string): string {
  return segunPlataforma({ ios: PISTA_CONTESTAR_EN_VOZ_IOS, android: PISTA_CONTESTAR_EN_VOZ }, os);
}

// ——— Cómo suena ———

export const ETIQUETA_VOZ = 'Mi voz';
export const DESC_VOZ = 'Las mejores voces en español de tu teléfono. Funcionan sin internet.';
/** Android: la voz de Google suena mejor con internet y sin él usa su versión del teléfono. */
export const DESC_VOZ_ANDROID =
  'Las mejores voces en español de tu teléfono. Con internet uso la versión más natural; sin internet, la del teléfono.';

export function descVoz(os?: string): string {
  return segunPlataforma({ ios: DESC_VOZ, android: DESC_VOZ_ANDROID }, os);
}

export const CARGANDO_VOCES = 'Buscando las voces de tu teléfono…';
export const SIN_VOCES =
  'Tu teléfono no tiene voces en español. Puedes instalarlas en los ajustes de voz del teléfono; mientras, te contesto en pantalla.';

export const ETIQUETA_ESCUCHAR = 'Escuchar';

/** TalkBack/VoiceOver del botón «Escuchar» de cada voz: «Escuchar Paulina mejorada». */
export function etiquetaEscucharVoz(etiqueta: string): string {
  return `Escuchar ${etiqueta.replace(/[()]/g, '')}`.replace(/\s{2,}/g, ' ').trim();
}

export const PISTA_ESCUCHAR = 'Te digo una frase de ejemplo con esta voz';
export const PISTA_ELEGIR_VOZ = 'Contesto con esta voz';

/** La frase de ejemplo: lo que de verdad diría tras un registro (`fraseHablada`). */
export const FRASE_MUESTRA_VOZ =
  'Listo, coca de veinticinco en efectivo. Te quedan ciento ochenta y nueve para hoy.';

export const ETIQUETA_VELOCIDAD = 'Velocidad';

export const ETIQUETAS_VELOCIDAD: Readonly<Record<VelocidadVoz, string>> = {
  pausada: 'Pausada',
  normal: 'Normal',
  rapida: 'Rápida',
};

/** Solo iPhone: Android no calla la voz con el modo silencio (usa el volumen de multimedia). */
export const ETIQUETA_SILENCIO_IOS = 'Hablar aunque el iPhone esté en silencio';
export const DESC_SILENCIO_IOS =
  'Si tienes el iPhone en silencio, te contesto solo en pantalla. Enciéndelo para oírme de todos modos.';

/** Una sola vez, en iPhone sin voz mejorada en español de México. */
export const TITULO_GUIA_MEJORADA = 'Una voz más natural';
export const GUIA_VOZ_MEJORADA_IOS =
  'Descarga «Paulina (mejorada)» en tu iPhone: Ajustes › Accesibilidad › Contenido leído › Voces › Español (México). Cuando vuelvas, la uso sola.';
/** VoiceOver lee «›» como signo: la ruta se dice con comas. */
export const GUIA_VOZ_MEJORADA_IOS_HABLADA =
  'Descarga Paulina mejorada en tu iPhone: en Ajustes, Accesibilidad, Contenido leído, Voces, Español (México). Cuando vuelvas, la uso sola.';
export const ETIQUETA_ENTENDIDO = 'Entendido';
