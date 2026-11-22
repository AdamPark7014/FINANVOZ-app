import { SeccionVoz } from '../../src/pantallas/ajustes/SeccionVoz';
import { Subpantalla } from '../../src/pantallas/ajustes/Subpantalla';
import { BAJADA_VOZ, TITULO_VOZ } from '../../src/pantallas/ajustes/textos';

/** Tú › Voz (`02 §12`): contestar en voz alta, confirmar por voz y cómo suena. */
export default function AjustesVoz() {
  return (
    <Subpantalla testID="ajustes-voz-pantalla" titulo={TITULO_VOZ} bajada={BAJADA_VOZ}>
      <SeccionVoz />
    </Subpantalla>
  );
}
