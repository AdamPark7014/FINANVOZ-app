import { SeccionAvisos } from '../../src/pantallas/ajustes/SeccionAvisos';
import { SeccionCaptura } from '../../src/pantallas/ajustes/SeccionCaptura';
import { SeccionWidget } from '../../src/pantallas/ajustes/SeccionWidget';
import { Subpantalla } from '../../src/pantallas/ajustes/Subpantalla';
import { BAJADA_AVISOS, TITULO_AVISOS } from '../../src/pantallas/ajustes/textos';

/** Tú › Avisos y captura (`02 §12`): avisos de tarjetas y pagos, captura de notificaciones y widget (Android). */
export default function AjustesAvisos() {
  return (
    <Subpantalla testID="ajustes-avisos-pantalla" titulo={TITULO_AVISOS} bajada={BAJADA_AVISOS}>
      <SeccionAvisos />
      <SeccionCaptura />
      <SeccionWidget />
    </Subpantalla>
  );
}
