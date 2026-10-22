import type { Observacion } from '../../servicios';
import { etiquetaHablada, formatearCentavos } from '../../ui/formato';

/**
 * Redacción de "Lo que veo" (`02 §4.3`, `02 §14`): solo presentación de lo que ya calculó
 * `servicios/observaciones.ts`. Dice qué pasó, con cifras; nunca qué hacer (`08 §1`).
 */

export const TITULO_OBSERVACIONES = 'Lo que veo';
export const BTN_YA_LO_VI = 'Ya lo vi';
/** TalkBack (`02 §15`). */
export const PISTA_YA_LO_VI = 'Oculta esta observación';
export const PISTA_VER_MOVIMIENTOS_OBSERVACION = 'Abre Movimientos con los movimientos de esta observación';

/** "de tu quincena anterior" · "del mes pasado". */
function periodoAnterior(concepto: string | null): string {
  return concepto === null ? 'del mes pasado' : `de tu ${concepto} anterior`;
}

export function textoObservacion(o: Observacion): string {
  switch (o.tipo) {
    case 'comparativa':
      return `Llevas ${formatearCentavos(o.actual)} en ${o.nombreCategoria}; a estas alturas ${periodoAnterior(o.periodo.concepto)} llevabas ${formatearCentavos(o.anterior)}.`;
    case 'inusual':
      return `Los ${formatearCentavos(o.monto)} en ${o.nombreCategoria} de ${o.cuando} fueron más de lo normal en esa categoría.`;
    case 'doble': {
      const cuando = o.cuando === 'otro' ? `el ${o.etiquetaFecha}` : o.cuando;
      return o.comercio !== null
        ? `Hay dos cargos iguales de ${formatearCentavos(o.monto)} en ${o.comercio} ${cuando}.`
        : `Hay dos gastos iguales de ${formatearCentavos(o.monto)} («${o.descripcion ?? ''}») ${cuando}.`;
    }
    case 'ritmo':
      return `Va el ${o.porcentajeDias} % de tu ${o.periodo.concepto} y llevas el ${o.porcentajeGastado} % de lo libre (${formatearCentavos(o.gastado)}).`;
    case 'suscripciones':
      return `Este mes van ${formatearCentavos(o.total)} en ${o.cantidad} suscripciones.`;
  }
}

/** Frase que antecede a la cifra en TalkBack ("Comida fuera en este periodo mil doscientos cuarenta pesos"). */
export function contextoCifraObservacion(o: Observacion): string {
  switch (o.tipo) {
    case 'comparativa':
      return `${capitalizar(o.nombreCategoria)} en este periodo`;
    case 'inusual':
      return `Gasto en ${o.nombreCategoria}`;
    case 'doble':
      return 'Cargo repetido';
    case 'ritmo':
      return 'Gastado de lo libre';
    case 'suscripciones':
      return 'Suscripciones este mes';
  }
}

/** TalkBack de la observación completa: título y frase con las cifras en palabras (`02 §15`). */
export function etiquetaObservacion(o: Observacion): string {
  return `${TITULO_OBSERVACIONES}. ${etiquetaHablada(textoObservacion(o))}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
