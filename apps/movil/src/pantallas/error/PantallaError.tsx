import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Boton, espacio, Pantalla, Texto } from '../../ui';

export const TITULO_ERROR_PANTALLA = 'Algo salió mal en esta pantalla';
export const TEXTO_ERROR_PANTALLA =
  'Lo que ya registraste sigue guardado en tu teléfono. Intenta de nuevo; si vuelve a pasar, cierra y abre la app.';
export const BTN_REINTENTAR_PANTALLA = 'Intentar de nuevo';
export const PISTA_REINTENTAR_PANTALLA = 'Vuelve a abrir esta pantalla';
/** Código del reporte: sin mensaje ni pila (podrían llevar montos o nombres, regla 9). */
export const CODIGO_ERROR_PANTALLA = 'pantalla_error';

/**
 * Límite de errores de Expo Router (`export { ErrorBoundary }` en `app/_layout.tsx`): antes, cualquier excepción al
 * pintar una pantalla cerraba la app entera. Ahora se queda en una pantalla amable con «Intentar de nuevo», y a
 * Sentry solo llega el código y el tipo de error.
 */
export function PantallaError({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    Sentry.captureMessage(CODIGO_ERROR_PANTALLA, { level: 'error', tags: { tipo: error.name || 'Error' } });
  }, [error]);
  return (
    <Pantalla testID="pantalla-error" bordes={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', gap: espacio.l, paddingVertical: espacio.xxxl }}>
        <Texto variante="titulo" accessibilityRole="header">
          {TITULO_ERROR_PANTALLA}
        </Texto>
        <Texto variante="cuerpo" tono="secundario">
          {TEXTO_ERROR_PANTALLA}
        </Texto>
        <Boton
          etiqueta={BTN_REINTENTAR_PANTALLA}
          pista={PISTA_REINTENTAR_PANTALLA}
          alPresionar={() => void retry()}
          testID="pantalla-error-reintentar"
        />
      </View>
    </Pantalla>
  );
}
