import { etiquetaEstadoVacio } from '../formato';
import { Texto } from './Texto';

/**
 * Copy secundario cuando una sección no tiene filas (`02 §10`, `02 §11`).
 * Convención es-MX: listas sin datos → «Todavía no…»; neutros → «No hay…» / «No debes…» en los `textos.ts` de cada pantalla.
 * TalkBack (`etiquetaEstadoVacio`): cifras en palabras y «Todavía…» al inicio se oye «Aún…»;
 * live region al aparecer; `pistaCta` señala el botón principal debajo.
 */
export function EstadoVacio({
  texto,
  testID,
  etiquetaAccesible,
  pistaCta,
}: {
  texto: string;
  testID: string;
  /** Incluye el título de sección para TalkBack (p. ej. «Tienes. …»). */
  etiquetaAccesible?: string;
  /** Pista del CTA justo debajo (p. ej. «Más abajo, botón Nueva tanda»). */
  pistaCta?: string;
}) {
  return (
    <Texto
      variante="cuerpo"
      tono="secundario"
      testID={testID}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={etiquetaAccesible ?? etiquetaEstadoVacio(texto)}
      {...(pistaCta === undefined ? {} : { accessibilityHint: pistaCta })}
    >
      {texto}
    </Texto>
  );
}
