import { useCallback, useRef, type RefObject } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** Distancia al final (pt) que todavía cuenta como «estoy viendo lo último». */
export const UMBRAL_FINAL = 48;

/** ¿La vista muestra el final del contenido (con el umbral)? */
export function estaAlFinal(
  offsetY: number,
  altoContenido: number,
  altoVisible: number,
  umbral = UMBRAL_FINAL,
): boolean {
  return altoContenido - (offsetY + altoVisible) <= umbral;
}

type Desplazable = { scrollToEnd: (opciones?: { animated?: boolean }) => void };

/**
 * La conversación termina en lo último (auditoría H1, 26-10-2026): antes solo bajaba cuando cambiaba el contenido, y
 * cuando la barra de voz crecía (vuelven los chips y el micrófono tras escuchar, se cierra el teclado) el alto visible
 * se achicaba sin volver a bajar: las opciones de «No entendí» quedaban cortadas debajo de la barra. Ahora también
 * baja cuando cambia el alto visible, salvo que la persona haya subido a leer turnos anteriores.
 */
export function useSeguirAlFinal(lista: RefObject<Desplazable | null>) {
  const alFinal = useRef(true);
  const altoVisible = useRef(0);

  const bajar = useCallback(
    (animado: boolean) => {
      lista.current?.scrollToEnd({ animated: animado });
      alFinal.current = true;
    },
    [lista],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    alFinal.current = estaAlFinal(contentOffset.y, contentSize.height, layoutMeasurement.height);
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const alto = Math.round(e.nativeEvent.layout.height);
      if (alto === altoVisible.current) return;
      altoVisible.current = alto;
      if (alFinal.current) bajar(false);
    },
    [bajar],
  );

  // Un turno nuevo (o uno que crece al terminar de pintarse) siempre se muestra: es la respuesta que se espera ver.
  const onContentSizeChange = useCallback(() => bajar(true), [bajar]);

  return { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 64 } as const;
}
