import { useEffect } from 'react';
import { anunciar, etiquetaHablada } from '../../ui';

/**
 * Anuncia `texto` a VoiceOver cada vez que aparece o cambia (errores, confirmaciones en línea). Usa `anunciar()`
 * de `ui/`, que solo actúa en iPhone (en Android lo dice la región viva del texto); las cifras van en palabras.
 */
export function useAnunciarEnIos(texto: string | null | undefined): void {
  useEffect(() => {
    if (texto) anunciar(etiquetaHablada(texto));
  }, [texto]);
}
