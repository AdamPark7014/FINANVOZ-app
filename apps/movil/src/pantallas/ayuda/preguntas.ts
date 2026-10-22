import { RESPONSABLE } from '../onboarding/aviso';
import {
  ASUNTO_CORREO_AYUDA,
  PREGUNTAS_FRECUENTES,
  PREGUNTAS_FRECUENTES_IOS,
  preguntasFrecuentes,
} from './textos';

export type { PreguntaFrecuente } from './textos';

export { ASUNTO_CORREO_AYUDA, PREGUNTAS_FRECUENTES, PREGUNTAS_FRECUENTES_IOS, preguntasFrecuentes };

/** Correo de contacto: el del responsable en el aviso de privacidad (`08 §2`). */
export const CORREO_AYUDA = RESPONSABLE.correo;

/** `mailto:` con solo el asunto: sin cuerpo, sin versión, sin identificadores (regla 9). */
export function enlaceCorreoAyuda(): string {
  return `mailto:${CORREO_AYUDA}?subject=${encodeURIComponent(ASUNTO_CORREO_AYUDA)}`;
}
