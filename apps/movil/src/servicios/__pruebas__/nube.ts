import { Interpretacion, type ContextoInterprete, type ResultadoNube } from '@cartera/nlu';
import type { NivelNube } from '../nube';

/**
 * Nube falsa para las pruebas de servicios: responde `Interpretacion` enlatadas por texto (validadas con el
 * esquema Zod, como haría el cliente real) y deja ver qué frases y qué contexto recibió, en orden.
 */
export function nubeFalsa(respuestas: Record<string, unknown | ResultadoNube> = {}) {
  let enLinea = true;
  let fallarCon: ResultadoNube | null = null;
  const oyentes = new Set<() => void>();
  const recibidas: { texto: string; contexto: ContextoInterprete }[] = [];
  const nube: NivelNube = {
    cliente: {
      interpretar: async (texto, contexto) => {
        recibidas.push({ texto, contexto });
        if (fallarCon) return fallarCon;
        const r = respuestas[texto];
        if (r === undefined) throw new Error('frase sin respuesta enlatada');
        if (typeof r === 'object' && r !== null && 'tipo' in r) return r as ResultadoNube;
        return {
          tipo: 'ok',
          interpretacion: Interpretacion.parse(r),
          meta: { proveedor: 'falso', modelo: 'falso', tokensEntrada: 0, tokensSalida: 0, latenciaMs: 0 },
        };
      },
    },
    conectividad: {
      enLinea: async () => enLinea,
      alReconectar: (f) => {
        oyentes.add(f);
        return () => oyentes.delete(f);
      },
    },
  };
  return {
    nube,
    recibidas,
    responder(texto: string, interpretacion: unknown) {
      respuestas[texto] = interpretacion;
    },
    desconectar() {
      enLinea = false;
    },
    reconectar() {
      enLinea = true;
      for (const f of oyentes) f();
    },
    /** Todas las llamadas siguientes devuelven este resultado (o vuelven a la normalidad con `null`). */
    fallar(r: ResultadoNube | null) {
      fallarCon = r;
    },
  };
}
