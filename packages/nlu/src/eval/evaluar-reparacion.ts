/**
 * Reparación de «No entendí» contra `fixtures/nlu/golden-reparacion.jsonl` (docs/diseno/OLA-7-ASISTENTE.md §3,
 * CA-O7 3). Cada caso exige las opciones en el orden esperado, con la frase reescrita exacta cuando la hay, y además:
 * a lo más 4 opciones, «otra» al final y al menos 3 si se oyó algo; cada frase la entiende el nivel 0 como ese tipo de
 * movimiento con el monto oído. Todo caso cuenta para cobertura y precisión. Reporta solo ids y rutas, nunca lo oído
 * (regla 9).
 */
import type { ContextoInterprete } from '../contexto';
import { MAX_OPCIONES_REPARACION, sugerirReparacion, type OpcionReparacion } from '../pasos/reparacion';
import { interpretarReglas } from '../reglas';
import type { ResultadoCaso } from './evaluar';
import { compararLectura, type ReportePasos } from './evaluar-pasos';
import type { CasoReparacion } from './fixtures';

export type ReporteReparacion = ReportePasos;

const MOVIMIENTO_DE: Readonly<Record<string, string>> = {
  gasto: 'gasto',
  ingreso: 'ingreso',
  prestamo: 'prestamo_otorgado',
  me_pagaron: 'cobro_prestamo',
  pago_tarjeta: 'pago_tarjeta',
  transferencia: 'transferencia',
};

/** Reglas que toda lista de opciones cumple, más allá del golden. Devuelve las rutas que fallan. */
export function revisarOpciones(
  opciones: readonly OpcionReparacion[],
  oido: string,
  contexto: ContextoInterprete,
): string[] {
  if (oido.trim() === '') return opciones.length === 0 ? [] : ['(vacío)'];
  const fallas: string[] = [];
  if (opciones.length < 3 || opciones.length > MAX_OPCIONES_REPARACION) fallas.push('(cantidad)');
  if (opciones[opciones.length - 1]?.tipo !== 'otra') fallas.push('(otra al final)');
  if (new Set(opciones.map((o) => o.tipo)).size !== opciones.length) fallas.push('(repetidas)');
  opciones.forEach((o, i) => {
    if (o.frase === undefined) return;
    const leido = interpretarReglas(o.frase, contexto);
    const [m] = leido?.intencion === 'registrar' ? leido.movimientos : [];
    if (!m || m.tipo !== MOVIMIENTO_DE[o.tipo] || m.monto !== o.monto) fallas.push(`[${i}].frase`);
  });
  return fallas;
}

export function evaluarReparacion(
  casos: readonly CasoReparacion[],
  contexto: ContextoInterprete,
): ReporteReparacion {
  const resultados = casos.map((caso): ResultadoCaso => {
    const opciones = sugerirReparacion(caso.texto, contexto);
    const obtenido = opciones.map((o) => ({
      tipo: o.tipo,
      ...(o.frase !== undefined ? { frase: o.frase } : {}),
    }));
    const fallas = [
      ...compararLectura(caso.esperado, obtenido),
      ...revisarOpciones(opciones, caso.texto, contexto),
    ];
    return { id: caso.id, marcadoReglas: true, respondio: true, correcto: fallas.length === 0, fallas };
  });
  const correctos = resultados.filter((r) => r.correcto).length;
  return {
    casos: resultados,
    marcados: resultados.length,
    marcadosCubiertos: correctos,
    respondidos: resultados.length,
    respondidosCorrectos: correctos,
    aprobado: correctos === resultados.length,
  };
}
