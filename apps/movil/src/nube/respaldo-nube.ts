import { z } from 'zod';
import { conTiempo, type FetchNube, fetchPlataforma, jsonDe, type RespuestaNube } from './http';
import type { SesionNube } from './sesion';

/**
 * Cliente de la Edge Function `respaldo` (M9, `03 §5.7` y `§6`). Sube, lista y baja blobs `.cartera` ya cifrados
 * en el teléfono (E16, `packages/respaldo`): este módulo no sabe qué hay dentro y nunca los registra.
 *
 * - `subir`: `POST /respaldo/url {operacion: 'subir', version}` → URL firmada de Storage (el servidor pone el
 *   nombre con su fecha) → `PUT` de los bytes → `GET /respaldo/lista`, que confirma la subida y deja los 4 más
 *   recientes (CA-M9-04).
 * - `bajar`: `POST /respaldo/url {operacion: 'bajar', nombre}` → URL firmada de 5 min → `GET` de los bytes.
 * - `borrarCuenta`: `DELETE /respaldo/cuenta` borra todos los archivos y después el usuario (CA-M9-07). Luego la
 *   app llama a `CuentaRespaldo.olvidarSesion()`.
 *
 * Necesita una sesión de correo (`cuenta-respaldo.ts`); con la anónima el servidor responde `sin_correo`. Solo se
 * mandan bytes a URLs firmadas del mismo proyecto de Supabase.
 */
export interface RespaldoNube {
  listar(): Promise<ResultadoNube<{ respaldos: RespaldoRemoto[] }>>;
  subir(
    bytes: Uint8Array,
    version: number,
  ): Promise<ResultadoNube<{ nombre: string; respaldos: RespaldoRemoto[] }>>;
  bajar(nombre: string): Promise<ResultadoNube<{ bytes: Uint8Array }>>;
  borrarCuenta(): Promise<ResultadoNube<object>>;
}

export interface RespaldoRemoto {
  /** `AAAAMMDDTHHMMSSZ-v<version>.cartera` (lo pone el servidor). */
  readonly nombre: string;
  readonly tamano: number;
  /** ISO 8601 de Storage. */
  readonly creadoEn: string;
  /** Versión del formato `.cartera`. */
  readonly version: number;
}

export type ErrorRespaldoNube =
  | 'sin_red'
  /** No hay JWT o el servidor no lo acepta ni tras renovarlo. */
  | 'sin_sesion'
  /** La sesión es anónima: hay que entrar con el correo y el código. */
  | 'sin_correo'
  | 'no_encontrado'
  | 'demasiado_grande'
  /** Ya hay un respaldo de este mismo segundo. */
  | 'ocupado'
  | 'servidor';

export type ResultadoNube<T> = ({ ok: true } & T) | { ok: false; error: ErrorRespaldoNube };

export interface OpcionesRespaldoNube {
  /** `https://<ref>.supabase.co` */
  readonly url: string;
  readonly sesion: SesionNube;
  readonly fetch?: FetchNube;
}

/** Ruta de la Edge Function bajo la URL del proyecto. */
export const RUTA_RESPALDO = '/functions/v1/respaldo';
/** Límite del bucket por archivo (12.5 MB; 4 archivos = 50 MB por usuario). */
export const TAMANO_MAXIMO_RESPALDO = 13_107_200;
const TIEMPO_FUNCION_MS = 15_000;
const TIEMPO_TRANSFERENCIA_MS = 120_000;

const Listado = z.object({
  respaldos: z.array(
    z.object({
      nombre: z.string().min(1),
      tamano: z.number().int().nonnegative(),
      creado_en: z.string(),
      version: z.number().int().positive(),
    }),
  ),
});
const UrlFirmada = z.object({ nombre: z.string().min(1), url: z.string().min(1) });

const ERRORES_SERVIDOR: Record<string, ErrorRespaldoNube> = {
  sin_correo: 'sin_correo',
  no_encontrado: 'no_encontrado',
  ocupado: 'ocupado',
};

type Falla = { ok: false; error: ErrorRespaldoNube };
const falla = (error: ErrorRespaldoNube): Falla => ({ ok: false, error });

export function crearRespaldoNube(opciones: OpcionesRespaldoNube): RespaldoNube {
  const base = opciones.url.replace(/\/+$/, '');
  const origenStorage = `${base}/storage/v1/`;
  const fetchNube = opciones.fetch ?? fetchPlataforma;

  /** Llama a la función con el JWT; ante un 401 renueva el token una vez. */
  async function funcion(
    metodo: 'GET' | 'POST' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<{ r: RespuestaNube; datos: unknown } | Falla> {
    for (const renovar of [false, true]) {
      const token = await opciones.sesion.obtenerToken({ renovar });
      if (token === null) return falla('sin_sesion');
      const r = await conTiempo(TIEMPO_FUNCION_MS, (signal) =>
        fetchNube(`${base}${RUTA_RESPALDO}${ruta}`, {
          method: metodo,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
          signal,
        }),
      );
      if (r.status === 401 && !renovar) continue;
      if (r.status === 401) return falla('sin_sesion');
      const datos = await jsonDe(r);
      if (r.status >= 200 && r.status < 300) return { r, datos };
      const codigo = (datos as { error?: unknown } | null)?.error;
      return falla((typeof codigo === 'string' && ERRORES_SERVIDOR[codigo]) || 'servidor');
    }
    return falla('sin_sesion');
  }

  const deStorage = (url: string) => url.startsWith(origenStorage);

  async function listar(): Promise<ResultadoNube<{ respaldos: RespaldoRemoto[] }>> {
    const res = await funcion('GET', '/lista');
    if ('ok' in res) return res;
    const l = Listado.safeParse(res.datos);
    if (!l.success) return falla('servidor');
    return {
      ok: true,
      respaldos: l.data.respaldos.map((x) => ({
        nombre: x.nombre,
        tamano: x.tamano,
        creadoEn: x.creado_en,
        version: x.version,
      })),
    };
  }

  // Sin red (o tiempo agotado) cualquier paso rechaza: se reporta como `sin_red`.
  const protegido =
    <A extends unknown[], T>(f: (...a: A) => Promise<ResultadoNube<T>>) =>
    async (...a: A): Promise<ResultadoNube<T>> => {
      try {
        return await f(...a);
      } catch {
        return falla('sin_red');
      }
    };

  return {
    listar: protegido(listar),

    subir: protegido(async (bytes: Uint8Array, version: number) => {
      if (bytes.length > TAMANO_MAXIMO_RESPALDO) return falla('demasiado_grande');
      const res = await funcion('POST', '/url', { operacion: 'subir', version });
      if ('ok' in res) return res;
      const firmada = UrlFirmada.safeParse(res.datos);
      if (!firmada.success || !deStorage(firmada.data.url)) return falla('servidor');
      const r = await conTiempo(TIEMPO_TRANSFERENCIA_MS, (signal) =>
        fetchNube(firmada.data.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
          body: bytes,
          signal,
        }),
      );
      if (r.status === 413) return falla('demasiado_grande');
      if (r.status < 200 || r.status >= 300) return falla('servidor');
      // La lista confirma que llegó y poda a los 4 más recientes.
      const lista = await listar();
      if (!lista.ok) return lista;
      if (!lista.respaldos.some((x) => x.nombre === firmada.data.nombre)) return falla('servidor');
      return { ok: true, nombre: firmada.data.nombre, respaldos: lista.respaldos };
    }),

    bajar: protegido(async (nombre: string) => {
      const res = await funcion('POST', '/url', { operacion: 'bajar', nombre });
      if ('ok' in res) return res;
      const firmada = UrlFirmada.safeParse(res.datos);
      if (!firmada.success || !deStorage(firmada.data.url)) return falla('servidor');
      const r = await conTiempo(TIEMPO_TRANSFERENCIA_MS, (signal) =>
        fetchNube(firmada.data.url, { method: 'GET', headers: {}, signal }),
      );
      if (r.status === 404 || r.status === 400) return falla('no_encontrado');
      if (r.status < 200 || r.status >= 300) return falla('servidor');
      return { ok: true, bytes: new Uint8Array(await r.arrayBuffer()) };
    }),

    borrarCuenta: protegido(async () => {
      const res = await funcion('DELETE', '/cuenta');
      if ('ok' in res) return res;
      return { ok: true };
    }),
  };
}
