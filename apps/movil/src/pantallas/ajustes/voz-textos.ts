import { segunPlataforma } from './plataforma';

/** Redacción Ajustes › Voz (`02 §14`): tuteo, sin tecnicismos. */

export const SECCION_VOZ = 'Voz';

export const ETIQUETA_CONTESTAR_EN_VOZ = 'Contestarte en voz';

export const DESC_CONTESTAR_EN_VOZ =
  'Cuando dictas, te digo en voz alta lo que registré y cuánto puedes gastar hoy.';

/** Con TalkBack encendido no hablo encima del lector (lo anuncia el aviso). */
export const PISTA_CONTESTAR_EN_VOZ = 'Con TalkBack encendido no hablo; el lector te lo anuncia.';
/** En iPhone el lector es VoiceOver (`voz/respuesta.ts` revisa cualquier lector de pantalla). */
export const PISTA_CONTESTAR_EN_VOZ_IOS = 'Con VoiceOver encendido no hablo; el lector te lo anuncia.';

export function pistaContestarEnVoz(os?: string): string {
  return segunPlataforma({ ios: PISTA_CONTESTAR_EN_VOZ_IOS, android: PISTA_CONTESTAR_EN_VOZ }, os);
}
