import type { Turno } from '../../../asistente/tipos';
import { TarjetaEntendi } from '../../../ui';

/** R1 «Entendí»: la tarjeta compartida de `ui/` con las filas, «Sí» y «Cambiar» (§3). */
export function TurnoEntendi({
  turno,
  testID,
}: {
  turno: Extract<Turno, { clase: 'entendi' }>;
  testID: string;
}) {
  return <TarjetaEntendi propuesta={turno.propuesta} testID={testID} />;
}
