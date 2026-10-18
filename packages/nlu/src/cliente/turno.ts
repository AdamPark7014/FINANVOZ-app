import { z } from 'zod';
import type { DefinicionHerramienta } from '../explicar/herramientas';
import {
  CODIGOS_LIMITE,
  TIEMPO_MAXIMO_LLM_MS,
  type CodigoErrorNube,
  type CodigoLimite,
  type MetadatosNube,
  type RespuestaTransporte,
  type Transporte,
} from './cliente';

/** Ruta de la Edge Function del modo explicar (`POST /llm/turno`, `03 §6`). */
export const RUTA_TURNO = '/functions/v1/llm-turno';

const Id = z.string().regex(/^[\w-]{1,64}$/);
const Llamada = z.strictObject({
  id: Id,
  nombre: z.string().min(1).max(40),
  argumentos: z.record(z.string(), z.unknown()),
});
export type LlamadaHerramienta = z.infer<typeof Llamada>;

export type MensajeTurno =
  | { readonly rol: 'usuario'; readonly texto: string }
  | { readonly rol: 'asistente'; readonly llamadas: readonly LlamadaHerramienta[] }
  | { readonly rol: 'herramienta'; readonly id: string; readonly nombre: string; readonly resultado: string };

const Salida = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('respuesta'), texto: z.string().max(4000) }),
  z.strictObject({ tipo: z.literal('herramientas'), llamadas: z.array(Llamada).min(1).max(8) }),
]);
export type SalidaTurno = z.infer<typeof Salida>;

const Sobre = z.object({
  salida: Salida,
  proveedor: z.string(),
  modelo: z.string(),
  tokens_entrada: z.number().int().min(0),
  tokens_salida: z.number().int().min(0),
  latencia_ms: z.number().int().min(0),
});
const SobreError = z.object({ error: z.string() });

export type ResultadoTurno =
  | { readonly tipo: 'ok'; readonly salida: SalidaTurno; readonly meta: MetadatosNube }
  | { readonly tipo: 'sin_red' }
  | { readonly tipo: 'solo_plus' }
  | { readonly tipo: 'limite'; readonly codigo: CodigoLimite }
  | { readonly tipo: 'error'; readonly codigo: CodigoErrorNube; readonly status?: number };

export interface ClienteTurno {
  turno(
    mensajes: readonly MensajeTurno[],
    herramientas: readonly DefinicionHerramienta[],
  ): Promise<ResultadoTurno>;
}

export interface OpcionesClienteTurno {
  readonly url: string;
  readonly obtenerToken: (opciones?: { renovar?: boolean }) => Promise<string | null>;
  readonly transporte?: Transporte;
  readonly tiempoMaximoMs?: number;
}

class TiempoAgotado extends Error {}

/**
 * Cliente de `POST /llm/turno` (modo explicar, `06 §6`): un turno sin estado. Valida la salida con Zod; ante un
 * 401 renueva el token una sola vez. No registra nada (regla 9): ni la pregunta, ni los resultados, ni la
 * respuesta.
 */
export function crearClienteTurno(opciones: OpcionesClienteTurno): ClienteTurno {
  const transporte: Transporte = opciones.transporte ?? ((url, p) => globalThis.fetch(url, p));
  const tiempoMaximo = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_LLM_MS;
  const destino = `${opciones.url.replace(/\/+$/, '')}${RUTA_TURNO}`;

  async function enviar(token: string, cuerpo: string): Promise<RespuestaTransporte> {
    const control = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        control.abort();
        rechazar(new TiempoAgotado());
      }, tiempoMaximo);
    });
    try {
      return await Promise.race([
        transporte(destino, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: cuerpo,
          signal: control.signal,
        }),
        limite,
      ]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  async function turno(
    mensajes: readonly MensajeTurno[],
    herramientas: readonly DefinicionHerramienta[],
  ): Promise<ResultadoTurno> {
    const cuerpo = JSON.stringify({ mensajes, herramientas });
    let respuesta: RespuestaTransporte | null = null;
    for (const renovar of [false, true]) {
      let token: string | null;
      try {
        token = await opciones.obtenerToken(renovar ? { renovar } : undefined);
      } catch {
        return { tipo: 'sin_red' };
      }
      if (token === null) return { tipo: 'error', codigo: 'sin_sesion' };
      try {
        respuesta = await enviar(token, cuerpo);
      } catch (e) {
        return e instanceof TiempoAgotado ? { tipo: 'error', codigo: 'tiempo_agotado' } : { tipo: 'sin_red' };
      }
      if (respuesta.status !== 401) break;
    }
    if (!respuesta) return { tipo: 'error', codigo: 'desconocido' };
    const status = respuesta.status;
    let json: unknown = null;
    try {
      json = await respuesta.json();
    } catch {
      // Cuerpo ilegible: se decide por el estado.
    }
    if (status >= 200 && status < 300) {
      const sobre = Sobre.safeParse(json);
      if (!sobre.success) return { tipo: 'error', codigo: 'respuesta_invalida', status };
      return {
        tipo: 'ok',
        salida: sobre.data.salida,
        meta: {
          proveedor: sobre.data.proveedor,
          modelo: sobre.data.modelo,
          tokensEntrada: sobre.data.tokens_entrada,
          tokensSalida: sobre.data.tokens_salida,
          latenciaMs: sobre.data.latencia_ms,
        },
      };
    }
    const codigo = SobreError.safeParse(json).data?.error;
    if (status === 403 && codigo === 'solo_plus') return { tipo: 'solo_plus' };
    if (status === 429) {
      return { tipo: 'limite', codigo: CODIGOS_LIMITE.find((c) => c === codigo) ?? 'limite_diario' };
    }
    if (status === 401) return { tipo: 'error', codigo: 'no_autorizado', status };
    if (status === 400) return { tipo: 'error', codigo: 'peticion_invalida', status };
    if (status === 504) return { tipo: 'error', codigo: 'tiempo_agotado', status };
    if (status >= 500) return { tipo: 'error', codigo: 'proveedor', status };
    return { tipo: 'error', codigo: 'desconocido', status };
  }

  return { turno };
}
