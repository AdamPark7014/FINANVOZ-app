import { SeccionBloqueo } from '../../src/pantallas/ajustes/SeccionBloqueo';
import { Subpantalla } from '../../src/pantallas/ajustes/Subpantalla';
import { BAJADA_SEGURIDAD, TITULO_SEGURIDAD } from '../../src/pantallas/ajustes/textos';

/** Tú › Bloqueo (`02 §12`, RF-CFG-03): huella o código al abrir y ocultar en multitarea. */
export default function AjustesSeguridad() {
  return (
    <Subpantalla testID="ajustes-seguridad-pantalla" titulo={TITULO_SEGURIDAD} bajada={BAJADA_SEGURIDAD}>
      <SeccionBloqueo />
    </Subpantalla>
  );
}
