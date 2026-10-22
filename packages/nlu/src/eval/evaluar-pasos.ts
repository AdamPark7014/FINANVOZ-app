/**
 * Lectores por paso contra `fixtures/nlu/golden-pasos.jsonl` (docs/06-NLU.md §13): cobertura de los casos
 * `reglas: true` y precisión sobre todo caso en que el lector responde. Un `esperado: null` dice que no hay lectura
 * correcta: responder ahí es un error. Reporta solo ids y rutas de campos, nunca textos ni cifras (regla 9).
 */
import type { ContextoInterprete } from '../contexto';
import { normalizarAlias } from '../normalizar';
import { interpretarPaso, PASOS, type Paso } from '../pasos';
import type { ResultadoCaso } from './evaluar';
import type { CasoPaso } from './fixtures';

export interface ReportePasos {
  casos: ResultadoCaso[];
  marcados: number;
  marcadosCubiertos: number;
  respondidos: number;
  respondidosCorrectos: number;
  aprobado: boolean;
}

/** Campos de texto libre: se comparan normalizados ("la renta" = "Renta"). */
const TEXTO_LIBRE = new Set(['concepto', 'nombre', 'cuentaAlias']);

/**
 * Rutas de los campos que difieren. A diferencia del golden principal, la comparación es estricta: un campo de más
 * en lo obtenido también falla (un dato inventado es un error de precisión).
 */
export function compararLectura(esperado: unknown, obtenido: unknown, ruta = ''): string[] {
  if (Array.isArray(esperado)) {
    if (!Array.isArray(obtenido) || obtenido.length !== esperado.length) return [ruta || '(raíz)'];
    return esperado.flatMap((e, i) => compararLectura(e, obtenido[i], `${ruta}[${i}]`));
  }
  if (esperado !== null && typeof esperado === 'object') {
    if (obtenido === null || typeof obtenido !== 'object' || Array.isArray(obtenido))
      return [ruta || '(raíz)'];
    const e = esperado as Record<string, unknown>;
    const o = obtenido as Record<string, unknown>;
    const claves = new Set([...Object.keys(e), ...Object.keys(o)]);
    return [...claves].sort().flatMap((k) => {
      const sub = ruta ? `${ruta}.${k}` : k;
      if (!(k in e) || !(k in o)) return [sub];
      if (TEXTO_LIBRE.has(k) && typeof e[k] === 'string' && typeof o[k] === 'string') {
        return normalizarAlias(e[k]) === normalizarAlias(o[k]) ? [] : [sub];
      }
      return compararLectura(e[k], o[k], sub);
    });
  }
  return esperado === obtenido ? [] : [ruta || '(raíz)'];
}

export function evaluarPasos(casos: readonly CasoPaso[], contexto: ContextoInterprete): ReportePasos {
  const resultados = casos.map((caso): ResultadoCaso => {
    const marcadoReglas = caso.reglas === true;
    if (!(PASOS as readonly string[]).includes(caso.paso)) {
      return { id: caso.id, marcadoReglas, respondio: false, correcto: false, fallas: ['paso'] };
    }
    const salida = interpretarPaso(caso.paso as Paso, caso.texto, contexto);
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
