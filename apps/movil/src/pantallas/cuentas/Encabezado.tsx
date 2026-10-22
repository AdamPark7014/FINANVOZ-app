import type { ReactNode } from 'react';
import { Boton, Texto } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import { ETIQUETA_VOLVER, PISTA_VOLVER_CUENTAS } from './textos';

/** «Volver» arriba y el título como encabezado, igual en todas las pantallas que salen de Cuentas. */
export function Encabezado({
  titulo,
  alVolver,
  testID,
  pistaVolver = PISTA_VOLVER_CUENTAS,
  children,
}: {
  titulo: string;
  alVolver: () => void;
  testID: string;
  pistaVolver?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Boton
        testID={`${testID}-volver`}
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        pista={pistaVolver}
        alPresionar={alVolver}
      />
      <Texto variante="titulo" testID={`${testID}-titulo`} accessibilityRole="header">
        {titulo}
      </Texto>
      {children}
    </>
  );
}

/** Error o confirmación en línea: TalkBack lo lee por la región viva y VoiceOver por `anunciar`. */
export function MensajeEnLinea({
  texto,
  error,
  testID,
}: {
  texto: string | null;
  error: boolean;
  testID: string;
}) {
  if (!texto) return null;
  return (
    <Texto
      variante="secundario"
      tono={error ? 'faltante' : 'acento'}
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      importantForAccessibility="yes"
      testID={testID}
    >
      {texto}
    </Texto>
  );
}

/** Fija el mensaje y lo anuncia en iPhone (VoiceOver no lee regiones vivas). */
export function conAnuncio(fijar: (texto: string | null) => void): (texto: string | null) => void {
  return (texto) => {
    fijar(texto);
    if (texto) anunciar(texto);
  };
}
