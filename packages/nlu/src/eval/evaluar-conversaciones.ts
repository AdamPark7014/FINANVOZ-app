/**
 * Nivel 0 contra el golden de conversaciones (docs/06-NLU.md §15): cada turno se interpreta con el turno anterior
 * en el contexto (lo dicho y lo **esperado** del último turno con interpretación: así un fallo no arrastra a los
 * siguientes). Los turnos de charla se miden con `leerCharla`, como los contesta la app: el nivel 0 no debe tomarlos
 * y la charla no debe tomar los demás. El reporte solo lleva ids y nombres de campo (regla 9).
 */
import { leerCharla } from '../charla';
import type { ContextoInterprete, TurnoAnterior } from '../contexto';
import { Interpretacion } from '../esquema';
import { interpretarReglas } from '../reglas';
import { compararInterpretacion } from './comparar';
import type { CasoConversacion, TurnoConversacion } from './fixtures';

export interface ResultadoTurno {
  /** `<caso>.<n>` con n desde 1. */
  id: string;
  /** El esperado es charla (la app contesta sin intérprete). */
  charla: boolean;
  /** El turno no es el primero de su caso. */
  seguimiento: boolean;
  marcadoReglas: boolean;
  respondio: boolean;
  correcto: boolean;
  fallas: string[];
}

export interface ReporteConversaciones {
  casos: number;
  turnos: ResultadoTurno[];
  marcados: number;
  marcadosCubiertos: number;
  respondidos: number;
  respondidosCorrectos: number;
  /** Casos con todos sus turnos correctos. */
  conversacionesCompletas: number;
  aprobado: boolean;
}

export const esCharla = (esperado: Record<string, unknown>): boolean => typeof esperado.charla === 'string';

/** El turno anterior del turno `i`: el último con interpretación esperada (la charla no cuenta). */
export function anteriorDelTurno(caso: CasoConversacion, i: number): TurnoAnterior | undefined {
  for (let k = i - 1; k >= 0; k--) {
    const previo = caso.turnos[k] as TurnoConversacion;
    if (!esCharla(previo.esperado)) {
      return { frase: previo.texto, interpretacion: previo.esperado as Interpretacion };
    }
  }
  return undefined;
}

/** El contexto con el que se interpreta el turno `i` (sin `anterior` en el primero o con `sinAnterior`). */
export function contextoDelTurno(
  caso: CasoConversacion,
  i: number,
  contexto: ContextoInterprete,
  sinAnterior = false,
): ContextoInterprete {
  const anterior = sinAnterior ? undefined : anteriorDelTurno(caso, i);
  return anterior ? { ...contexto, anterior } : contexto;
}

export function evaluarConversaciones(
  casos: readonly CasoConversacion[],
  contexto: ContextoInterprete,
): ReporteConversaciones {
  const turnos: ResultadoTurno[] = [];
  let completas = 0;
  for (const caso of casos) {
    let todoBien = true;
    caso.turnos.forEach((turno, i) => {
      const base = {
        id: `${caso.id}.${i + 1}`,
        seguimiento: i > 0,
        marcadoReglas: turno.reglas !== false,
      };
      const charlaLeida = leerCharla(turno.texto);
      const salida = interpretarReglas(turno.texto, contextoDelTurno(caso, i, contexto));
      let r: ResultadoTurno;
      if (esCharla(turno.esperado)) {
        // La app prueba primero el nivel 0: si lo toma, la charla nunca llega.
        const fallas =
          salida !== null ? ['interpretado'] : charlaLeida !== turno.esperado.charla ? ['charla'] : [];
        r = {
          ...base,
          charla: true,
          respondio: salida !== null || charlaLeida !== null,
          correcto: fallas.length === 0,
          fallas,
        };
      } else if (salida === null) {
        // Sin nivel 0, la charla que lo tome sería un error (contestaría algo que no se pidió).
        r = {
          ...base,
          charla: false,
          respondio: charlaLeida !== null,
          correcto: false,
          fallas: charlaLeida !== null ? ['charla'] : [],
        };
      } else {
        const valida = Interpretacion.safeParse(salida);
        const fallas = valida.success
          ? compararInterpretacion(turno.esperado, salida as Record<string, unknown>)
          : ['esquema'];
        r = { ...base, charla: false, respondio: true, correcto: fallas.length === 0, fallas };
      }
      if (!r.correcto) todoBien = false;
      turnos.push(r);
    });
    if (todoBien) completas++;
  }
  const marcados = turnos.filter((r) => r.marcadoReglas);
  const respondidos = turnos.filter((r) => r.respondio);
  const reporte = {
    casos: casos.length,
    turnos,
    marcados: marcados.length,
    marcadosCubiertos: marcados.filter((r) => r.respondio && r.correcto).length,
    respondidos: respondidos.length,
    respondidosCorrectos: respondidos.filter((r) => r.correcto).length,
    conversacionesCompletas: completas,
  };
  return {
    ...reporte,
    aprobado:
      reporte.marcadosCubiertos === reporte.marcados && reporte.respondidosCorrectos === reporte.respondidos,
  };
}
