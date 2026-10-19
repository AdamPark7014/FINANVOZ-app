import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';
import { IDIOMA_DICTADO } from './useDictado';

export { fraseRespuestaVoz } from './respuesta-textos';

/**
 * Dice el texto con la voz del teléfono (sin red). Con TalkBack encendido no habla: el lector ya anuncia el
 * aviso y dos voces encimadas no se entienden. Nada de esto va a logs (regla 9).
 */
export function decirEnVoz(texto: string): void {
  AccessibilityInfo.isScreenReaderEnabled()
    .then((lector) => {
      if (lector) return;
      Speech.stop();
      Speech.speak(texto, { language: IDIOMA_DICTADO });
    })
    .catch(() => {});
}

/** Calla la respuesta en curso (al volver a tocar el micrófono, para no grabarla). */
export function callarVoz(): void {
  try {
    Speech.stop();
  } catch {
    // Sin módulo nativo (pruebas, web): no hay nada que callar.
  }
}
