import {
  sugerirReparacion as sugerirReparacionNlu,
  type ContextoInterprete,
  type TipoReparacion,
} from '@cartera/nlu';
import { pesos } from '../servicios/formato';
import type { ChipRespuesta } from './tipos';

/**
 * «No entendí» con reparación en un toque (Ola 7 §2–§3, criterio 3): a partir de lo que se oyó, de 2 a 3 tipos de
 * movimiento ordenados por probabilidad y «Otra cosa» al final (`@cartera/nlu`, `pasos/reparacion.ts`, golden
 * `fixtures/nlu/golden-reparacion.jsonl`).
 *
 * Cada opción es un chip:
 * - Con frase reescrita («le presté 300 a Beto»), `valor` es esa frase: elegirla la manda a `registrarTexto` como si
 *   la persona la hubiera dicho (el nivel 0 la entiende tal cual). La etiqueta la muestra con la cifra en pesos.
 * - Sin frase, `valor` es el tipo reservado ('gasto' · 'ingreso' · 'prestamo' · 'me_pagaron' · 'pago_tarjeta' ·
 *   'transferencia' · 'otra'): abre R2 con ese tipo y, si se oyó una sola cifra, con `monto`.
 *
 * `contexto` (el de `servicios/registrar.contextoInterprete`) da las cuentas, los contactos y la fecha; sin él no hay
 * alias ni fechas en las frases. Lo oído nunca va a logs (regla 9).
 */
export interface OpcionReparacion extends ChipRespuesta {
  readonly tipo: TipoReparacion;
  /** Frase que el nivel 0 entiende tal cual (es también el `valor`). */
  readonly frase?: string;
  /** La única cifra oída, para prellenar R2. */
  readonly monto?: number;
}

/** Etiquetas de las opciones sin frase (02-UX §14: tuteo, sin tecnicismos). */
export const ETIQUETAS_REPARACION: Readonly<Record<TipoReparacion, string>> = {
  gasto: 'Fue un gasto',
  ingreso: 'Me entró dinero',
  prestamo: 'Le presté a alguien',
  me_pagaron: 'Me pagaron lo que me debían',
  pago_tarjeta: 'Pagué una tarjeta',
  transferencia: 'Pasé dinero entre mis cuentas',
  otra: 'Otra cosa',
};

/** La cifra tal como la escribe la frase reescrita ("300", "120.50"). */
function cifraDeFrase(centavos: number): string {
  const resto = centavos % 100;
  return `${Math.floor(centavos / 100)}${resto === 0 ? '' : `.${String(resto).padStart(2, '0')}`}`;
}

/** «le presté 300 a Beto» → «Le presté $300 a Beto»; «ayer registra 300» → «Ayer gasté $300». */
export function etiquetaDeFrase(frase: string, monto?: number): string {
  let texto = frase.replace(/\bregistra\b/, 'gasté');
  if (monto !== undefined) {
    const cifra = cifraDeFrase(monto);
    const patron = new RegExp(`(^|\\s)${cifra.replace('.', '\\.')}(?=\\s|$)`);
    texto = texto.replace(patron, (_, antes: string) => `${antes}${pesos(monto)}`);
  }
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function sugerirReparacion(oido: string, contexto?: ContextoInterprete): readonly OpcionReparacion[] {
  return sugerirReparacionNlu(oido, contexto).map((o) => ({
    tipo: o.tipo,
    valor: o.frase ?? o.tipo,
    etiqueta: o.frase !== undefined ? etiquetaDeFrase(o.frase, o.monto) : ETIQUETAS_REPARACION[o.tipo],
    ...(o.frase !== undefined ? { frase: o.frase } : {}),
    ...(o.monto !== undefined ? { monto: o.monto } : {}),
  }));
}
