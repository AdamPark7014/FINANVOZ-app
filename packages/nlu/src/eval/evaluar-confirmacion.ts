/**
 * Confirmación por voz contra `fixtures/nlu/golden-confirmacion.jsonl` (docs/diseno/OLA-7-ASISTENTE.md §4): cobertura
 * de los casos con lectura esperada y precisión sobre todo caso en que el lector responde. Un `esperado: null` dice
 * que la respuesta es ambigua: leer ahí un sí, un no o un cambio es un error (podría registrar algo que la persona no
 * quiso). Reporta solo ids y rutas de campos, nunca textos ni cifras (regla 9).
 */
import type { ContextoInterprete } from '../contexto';
import { leerConfirmacion } from '../pasos/confirmacion';
import type { ResultadoCaso } from './evaluar';
import { compararLectura, type ReportePasos } from './evaluar-pasos';
import type { CasoConfirmacion } from './fixtures';

export type ReporteConfirmacion = ReportePasos;

export function evaluarConfirmacion(
  casos: readonly CasoConfirmacion[],
  contexto: ContextoInterprete,
): ReporteConfirmacion {
  const resultados = casos.map((caso): ResultadoCaso => {
    const marcadoReglas = caso.esperado !== null;
    const salida = leerConfirmacion(caso.texto, { ...contexto, ...caso.tarjeta });
    if (salida === null) return { id: caso.id, marcadoReglas, respondio: false, correcto: false, fallas: [] };
    const fallas = caso.esperado === null ? ['esperaba null'] : compararLectura(caso.esperado, salida);
    return { id: caso.id, marcadoReglas, respondio: true, correcto: fallas.length === 0, fallas };
  });
  const marcados = resultados.filter((r) => r.marcadoReglas);
  const respondidos = resultados.filter((r) => r.respondio);
  const reporte = {
    casos: resultados,
    marcados: marcados.length,
    marcadosCubiertos: marcados.filter((r) => r.respondio && r.correcto).length,
    respondidos: respondidos.length,
    respondidosCorrectos: respondidos.filter((r) => r.correcto).length,
  };
  return {
    ...reporte,
    aprobado:
      reporte.marcadosCubiertos === reporte.marcados && reporte.respondidosCorrectos === reporte.respondidos,
  };
}
