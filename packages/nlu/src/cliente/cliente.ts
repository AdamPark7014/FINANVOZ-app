import { z } from 'zod';
import type { ContextoInterprete } from '../contexto';
import { Interpretacion } from '../esquema';

/** Versión del esquema `Interpretacion` que la app espera (`03 §6`). Sube con cada cambio incompatible. */
export const VERSION_ESQUEMA = 1;

/** Tiempo máximo de una interpretación (`03 §6`: 8 s). */
export const TIEMPO_MAXIMO_MS = 8_000;

/** Ruta de la Edge Function bajo la URL del proyecto de Supabase. */
export const RUTA_INTERPRETAR = '/functions/v1/nlu-interpretar';

/** Respuesta mínima que necesita el cliente; `fetch` la cumple. */
export interface RespuestaTransporte {
  readonly status: number;
  json(): Promise<unknown>;
}

export interface PeticionTransporte {
  readonly method: 'POST';
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal: AbortSignal;
}

/** Transporte HTTP inyectable (`fetch` en la app; uno falso en pruebas). */
export type Transporte = (url: string, peticion: PeticionTransporte) => Promise<RespuestaTransporte>;

export const CODIGOS_LIMITE = ['limite_diario', 'limite_mensual', 'tope_global'] as const;
export type CodigoLimite = (typeof CODIGOS_LIMITE)[number];

export type CodigoErrorNube =
  | 'sin_sesion'
  | 'no_autorizado'
  | 'peticion_invalida'
  | 'proveedor'
  | 'tiempo_agotado'
  | 'respuesta_invalida'
  | 'desconocido';

export interface MetadatosNube {
  readonly proveedor: string;
  readonly modelo: string;
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
  readonly latenciaMs: number;
}

/**
 * Resultado de una interpretación en la nube. `sin_red` y `error` dejan la frase "por interpretar"; `limite`
 * también, pero la UI puede decir por qué. Nunca lleva el texto dictado.
 */
export type ResultadoNube =
  | { readonly tipo: 'ok'; readonly interpretacion: Interpretacion; readonly meta: MetadatosNube }
  | { readonly tipo: 'sin_red' }
  | { readonly tipo: 'limite'; readonly codigo: CodigoLimite }
  | { readonly tipo: 'error'; readonly codigo: CodigoErrorNube; readonly status?: number };

export interface ClienteNube {
  interpretar(texto: string, contexto: ContextoInterprete): Promise<ResultadoNube>;
}

export interface OpcionesClienteNube {
  /** URL base del proyecto de Supabase (`https://<ref>.supabase.co`). */
  readonly url: string;
  /**
   * JWT de la sesión anónima. `renovar: true` pide uno nuevo (tras un 401). `null` = no hay sesión (sin red al
   * crearla o sin configuración).
   */
  readonly obtenerToken: (opciones?: { renovar?: boolean }) => Promise<string | null>;
  readonly transporte?: Transporte;
  readonly tiempoMaximoMs?: number;
}

const Sobre = z.object({
  interpretacion: z.unknown(),
  proveedor: z.string(),
  modelo: z.string(),
  tokens_entrada: z.number().int().min(0),
  tokens_salida: z.number().int().min(0),
  latencia_ms: z.number().int().min(0),
});
const SobreError = z.object({ error: z.string() });

class TiempoAgotado extends Error {}

const transportePorOmision: Transporte = (url, peticion) => globalThis.fetch(url, peticion);

/**
 * Cliente del proxy del intérprete (`03 §6`, `06 §2`). Valida la respuesta con el esquema Zod completo; el
 * reintento con el error de validación lo hace el proxy, así que aquí una respuesta inválida es
 * `respuesta_invalida` (la app la trata como `aclarar/no_entendi`). Ante un 401 renueva el token una sola vez.
 * No registra nada: ni el texto, ni el contexto, ni la respuesta (regla 9).
 */
export function crearClienteNube(opciones: OpcionesClienteNube): ClienteNube {
  const transporte = opciones.transporte ?? transportePorOmision;
  const tiempoMaximo = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS;
  const destino = `${opciones.url.replace(/\/+$/, '')}${RUTA_INTERPRETAR}`;

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

  async function leerJson(r: RespuestaTransporte): Promise<unknown> {
    try {
      return await r.json();
    } catch {
      return null;
    }
  }

  async function interpretar(texto: string, contexto: ContextoInterprete): Promise<ResultadoNube> {
    const cuerpo = JSON.stringify({ texto, contexto_min: contexto, version_esquema: VERSION_ESQUEMA });
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
    const json = await leerJson(respuesta);

    if (status >= 200 && status < 300) {
      const sobre = Sobre.safeParse(json);
      if (!sobre.success) return { tipo: 'error', codigo: 'respuesta_invalida', status };
      const interpretacion = Interpretacion.safeParse(sobre.data.interpretacion);
      if (!interpretacion.success) return { tipo: 'error', codigo: 'respuesta_invalida', status };
      return {
        tipo: 'ok',
        interpretacion: interpretacion.data,
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
    if (status === 429) {
      const limite = CODIGOS_LIMITE.find((c) => c === codigo) ?? 'limite_diario';
      return { tipo: 'limite', codigo: limite };
    }
    if (status === 401) return { tipo: 'error', codigo: 'no_autorizado', status };
    if (status === 400) return { tipo: 'error', codigo: 'peticion_invalida', status };
    if (status === 504) return { tipo: 'error', codigo: 'tiempo_agotado', status };
    if (status >= 500) return { tipo: 'error', codigo: 'proveedor', status };
    return { tipo: 'error', codigo: 'desconocido', status };
  }

  return { interpretar };
}
