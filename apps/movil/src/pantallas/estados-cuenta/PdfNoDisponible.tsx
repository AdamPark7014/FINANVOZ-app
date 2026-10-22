import { Platform } from 'react-native';
import { Boton, Pantalla, Texto } from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import {
  BTN_VOLVER,
  MENSAJE_NO_DISPONIBLE,
  MENSAJE_NO_DISPONIBLE_IOS,
  PISTA_VOLVER_PDF,
  TITULO_PANTALLA,
} from './textos';

/** ¿Este teléfono lee estados de cuenta en PDF? Solo Android tiene el lector (`07 §8`, M15). */
export const leePdfEnEsteTelefono = (): boolean => Platform.OS === 'android';

/**
 * Estado de cuenta en un teléfono sin lector de PDF (iPhone): qué pasa y "Volver", en vez de abrir el selector
 * para nada o quedarse en «Leyendo…». Sin hablar de Android en iPhone.
 */
export function PdfNoDisponible({ alVolver, texto }: { alVolver: () => void; texto?: string }) {
  const mensaje = texto ?? (Platform.OS === 'ios' ? MENSAJE_NO_DISPONIBLE_IOS : MENSAJE_NO_DISPONIBLE);
  useAnunciarEnIos(mensaje);
  return (
    <Pantalla testID="pantalla-pdf-no-disponible" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="pdf-no-disponible-volver"
        etiqueta={BTN_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER_PDF}
      />
      <Texto variante="titulo" accessibilityRole="header">
        {TITULO_PANTALLA}
      </Texto>
      <Texto
        variante="cuerpo"
        testID="pdf-no-disponible-mensaje"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {mensaje}
      </Texto>
    </Pantalla>
  );
}

/** Mientras se elige o se resuelve el PDF: el texto de espera con "Volver" por si nunca termina. */
export function EsperandoPdf({
  texto,
  alVolver,
  testID,
}: {
  texto: string;
  alVolver: () => void;
  testID?: string;
}) {
  return (
    <Pantalla bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="pdf-esperando-volver"
        etiqueta={BTN_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER_PDF}
      />
      <Texto variante="cuerpo" tono="secundario" testID={testID} accessibilityLiveRegion="polite">
        {texto}
      </Texto>
    </Pantalla>
  );
}
