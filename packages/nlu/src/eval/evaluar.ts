import type { ContextoInterprete } from '../contexto';
import { Interpretacion } from '../esquema';
import { interpretarReglas } from '../reglas';
import { compararInterpretacion } from './comparar';
import type { CasoGolden } from './fixtures';

export interface ResultadoCaso {
  id: string;
  marcadoReglas: boolean;
  respondio: boolean;
  correcto: boolean;
  /** Rutas de campos que fallaron (sin valores, regla 9). */
  fallas: string[];
}

export interface ReporteReglas {
  casos: ResultadoCaso[];
  marcados: number;
  marcadosCubiertos: number;
  respondidos: number;
  respondidosCorrectos: number;
  aprobado: boolean;
}

/** Nivel 0 contra el golden set (docs/06-NLU.md §8): cobertura de `reglas: true` y precisión sobre lo respondido. */
export function evaluarReglas(casos: readonly CasoGolden[], contexto: ContextoInterprete): ReporteReglas {
  const resultados = casos.map((caso): ResultadoCaso => {
    const marcadoReglas = caso.reglas === true;
    const salida = interpretarReglas(caso.texto, contexto);
    if (salida === null) return { id: caso.id, marcadoReglas, respondio: false, correcto: false, fallas: [] };
    const valida = Interpretacion.safeParse(salida);
    const fallas = valida.success
      ? compararInterpretacion(caso.esperado, salida as Record<string, unknown>)
      : ['esquema'];
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
