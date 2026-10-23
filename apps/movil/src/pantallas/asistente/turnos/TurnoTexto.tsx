import type { Turno } from '../../../asistente/tipos';
import { Texto } from '../../../ui';
import { BTN_VER_MOVIMIENTOS, PISTA_VER_MOVIMIENTOS } from '../textos';
import { AccionTexto, Burbuja } from './Burbuja';

/** Respuesta en texto (consulta, explicar, avisos sin acción) con «Ver movimientos» cuando aplica. */
export function TurnoTexto({ turno, testID }: { turno: Extract<Turno, { clase: 'texto' }>; testID: string }) {
  return (
    <Burbuja testID={testID}>
      <Texto variante="cuerpo" testID={`${testID}-texto`}>
        {turno.texto}
      </Texto>
      {turno.verMovimientos ? (
        <AccionTexto
          etiqueta={BTN_VER_MOVIMIENTOS}
          pista={PISTA_VER_MOVIMIENTOS}
          alPresionar={turno.verMovimientos}
          testID={`${testID}-ver-movimientos`}
        />
      ) : null}
    </Burbuja>
  );
}
