import type { ReactNode } from 'react';
import { espacio, Pantalla } from '../../ui';
import { TituloPantalla } from '../../ui/componentes/Lista';
import { BarraNativa } from '../../ui/navegacion';

/**
 * Una subpantalla de Tú (Voz, Avisos y captura, Bloqueo): barra nativa con «Atrás», título grande con su bajada y
 * las secciones de siempre debajo. Sin historial (un enlace directo), «Atrás» lleva a Tú.
 */
export function Subpantalla({
  testID,
  titulo,
  bajada,
  children,
}: {
  testID: string;
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  return (
    <>
      <BarraNativa salida="/tu" />
      <Pantalla
        testID={testID}
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <TituloPantalla testID={`${testID}-titulo`} titulo={titulo} bajada={bajada} />
        {children}
      </Pantalla>
    </>
  );
}
