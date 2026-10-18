import { etiquetaHablada } from '../formato';
import { Texto } from './Texto';

/**
 * Copy secundario cuando una sección no tiene filas (`02 §10`, `02 §11`).
 * Convención es-MX: listas sin datos → «Todavía no…»; neutros → «No hay…» / «No debes…» en los `textos.ts` de cada pantalla.
 */
export function EstadoVacio({
  texto,
  testID,
  etiquetaAccesible,
}: {
  texto: string;
  testID: string;
  /** Incluye el título de sección para TalkBack (p. ej. «Tienes. …»). */
  etiquetaAccesible?: string;
}) {
  return (
    <Texto
      variante="cuerpo"
      tono="secundario"
      testID={testID}
      accessibilityLiveRegion="polite"
      {...(etiquetaAccesible ? { accessibilityLabel: etiquetaAccesible } : {})}
    >
      {texto}
    </Texto>
  );
}
