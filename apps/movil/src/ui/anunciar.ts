import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Anuncia un resultado al lector de pantalla (02-UX §15). En Android lo dice la región viva
 * (`accessibilityLiveRegion`) del texto que aparece; VoiceOver ignora esa propiedad, así que en iPhone se
 * anuncia aquí. Úsalo solo con el resultado final (nunca con transcripciones parciales) y con las cifras ya
 * en palabras (`etiquetaHablada`). El texto no va a logs (regla 9).
 */
export function anunciar(texto: string): void {
  if (Platform.OS !== 'ios' || texto.trim() === '') return;
  try {
    AccessibilityInfo.announceForAccessibility(texto);
  } catch {
    // Sin lector de pantalla disponible no hay nada que anunciar.
  }
}

/** Anuncia `texto` en iPhone cada vez que aparece o cambia (errores y confirmaciones en línea). */
export function useAnunciar(texto: string | null | undefined): void {
  useEffect(() => {
    if (texto) anunciar(texto);
  }, [texto]);
}
