import { z } from 'zod';
import { conTiempo, type FetchNube, fetchPlataforma, jsonDe } from './http';
import type { SesionNube } from './sesion';

/**
 * Cliente de la Edge Function `compartido` (M16, `03 §5.10` y `§6`). Solo mueve blobs ya cifrados en el teléfono
 * (`packages/sincronizacion`) y los campos en claro de E17 (`grupo_id`, `id`, `autor`): nunca la llave, montos ni
 * nombres. No registra nada (regla 9).
 */
export type ErrorCompartido =
  | 'sin_red'
  /** No hay JWT o el servidor no lo acepta ni tras renovarlo. */
  | 'sin_sesion'
  /** Esta sesión ya no está en el grupo (otro teléfono ocupó su lugar o se restauró desde un archivo). */
  | 'no_miembro'
  | 'grupo_cerrado'
  /** Código de unión equivocado, vencido o ya usado. */
  | 'codigo_invalido'
  /** Quien escanea ya ocupa el otro lugar del grupo (escaneó su propio código). */
  | 'ya_miembro'
  | 'conflicto'
  | 'servidor';

export type ResultadoCompartido<T> = ({ ok: true } & T) | { ok: false; error: ErrorCompartido };

export interface EventoRemoto {
  readonly id: string;
  readonly autor: 'a' | 'b';
  readonly blob: string;
  readonly recibidoEn: string;
}

export interface ClienteCompartido {
  crearGrupo(): Promise<ResultadoCompartido<{ grupoId: string; codigoUnion: string }>>;
  pedirCodigo(grupoId: string): Promise<ResultadoCompartido<{ codigoUnion: string }>>;
  unirse(grupoId: string, codigoUnion: string): Promise<ResultadoCompartido<{ autor: 'a' | 'b' }>>;
  salir(grupoId: string): Promise<ResultadoCompartido<{ cerradoEn: string }>>;
  publicar(
    grupoId: string,
    eventos: readonly { id: string; blob: string }[],
  ): Promise<ResultadoCompartido<{ recibidos: { id: string; recibidoEn: string }[] }>>;
  descargar(
    grupoId: string,
    desde: string | null,
  ): Promise<
    ResultadoCompartido<{
      eventos: EventoRemoto[];
      cursor: string | null;
      mas: boolean;
      cerradoEn: string | null;
    }>
  >;
}

/** Ruta de la Edge Function bajo la URL del proyecto. */
export const RUTA_COMPARTIDO = '/functions/v1/compartido';
const TIEMPO_MS = 15_000;

const Instante = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const Autor = z.enum(['a', 'b']);
const Creado = z.object({ grupo_id: z.string().min(1), codigo_union: z.string().min(1) });
const Codigo = z.object({ codigo_union: z.string().min(1) });
const Unido = z.object({ autor: Autor });
const Cerrado = z.object({ cerrado_en: Instante });
const Publicado = z.object({ eventos: z.array(z.object({ id: z.string(), recibido_en: Instante })) });
const Descargado = z.object({
  eventos: z.array(z.object({ id: z.string(), autor: Autor, blob: z.string(), recibido_en: Instante })),
  cursor: Instante.nullable(),
  mas: z.boolean(),
  cerrado_en: Instante.nullable(),
});

const ERRORES: Record<string, ErrorCompartido> = {
  no_miembro: 'no_miembro',
  grupo_cerrado: 'grupo_cerrado',
  codigo_invalido: 'codigo_invalido',
  ya_miembro: 'ya_miembro',
  conflicto: 'conflicto',
};

type Falla = { ok: false; error: ErrorCompartido };
const falla = (error: ErrorCompartido): Falla => ({ ok: false, error });

export function crearClienteCompartido(opciones: {
  url: string;
  sesion: SesionNube;
  fetch?: FetchNube;
}): ClienteCompartido {
  const base = opciones.url.replace(/\/+$/, '');
  const fetchNube = opciones.fetch ?? fetchPlataforma;

  /** Llama a la función con el JWT; ante un 401 renueva el token una vez. Sin red rechaza (→ `sin_red`). */
  async function funcion<T>(
    metodo: 'GET' | 'POST',
    ruta: string,
    forma: z.ZodType<T>,
    cuerpo?: unknown,
  ): Promise<{ datos: T } | Falla> {
    for (const renovar of [false, true]) {
      const token = await opciones.sesion.obtenerToken({ renovar });
      if (token === null) return falla('sin_sesion');
      const r = await conTiempo(TIEMPO_MS, (signal) =>
        fetchNube(`${base}${RUTA_COMPARTIDO}/${ruta}`, {
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
      if (r.status >= 200 && r.status < 300) {
        const v = forma.safeParse(datos);
        return v.success ? { datos: v.data } : falla('servidor');
      }
      const codigo = (datos as { error?: unknown } | null)?.error;
      return falla((typeof codigo === 'string' && ERRORES[codigo]) || 'servidor');
    }
    return falla('sin_sesion');
  }

  const protegido =
    <A extends unknown[], T>(f: (...a: A) => Promise<ResultadoCompartido<T>>) =>
    async (...a: A): Promise<ResultadoCompartido<T>> => {
      try {
        return await f(...a);
      } catch {
        return falla('sin_red');
      }
    };

  return {
    crearGrupo: protegido(async () => {
      const r = await funcion('POST', 'grupos', Creado, {});
      if ('ok' in r) return r;
      return { ok: true as const, grupoId: r.datos.grupo_id, codigoUnion: r.datos.codigo_union };
    }),
    pedirCodigo: protegido(async (grupoId: string) => {
      const r = await funcion('POST', 'codigo', Codigo, { grupo_id: grupoId });
      if ('ok' in r) return r;
      return { ok: true as const, codigoUnion: r.datos.codigo_union };
    }),
    unirse: protegido(async (grupoId: string, codigoUnion: string) => {
      const r = await funcion('POST', 'unirse', Unido, { grupo_id: grupoId, codigo_union: codigoUnion });
      if ('ok' in r) return r;
      return { ok: true as const, autor: r.datos.autor };
    }),
    salir: protegido(async (grupoId: string) => {
      const r = await funcion('POST', 'salir', Cerrado, { grupo_id: grupoId });
      if ('ok' in r) return r;
      return { ok: true as const, cerradoEn: r.datos.cerrado_en };
    }),
    publicar: protegido(async (grupoId: string, eventos: readonly { id: string; blob: string }[]) => {
      const r = await funcion('POST', 'eventos', Publicado, { grupo_id: grupoId, eventos });
      if ('ok' in r) return r;
      return {
        ok: true as const,
        recibidos: r.datos.eventos.map((e) => ({ id: e.id, recibidoEn: e.recibido_en })),
      };
    }),
    descargar: protegido(async (grupoId: string, desde: string | null) => {
      const consulta = `grupo_id=${encodeURIComponent(grupoId)}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}`;
      const r = await funcion('GET', `eventos?${consulta}`, Descargado);
      if ('ok' in r) return r;
      return {
        ok: true as const,
        eventos: r.datos.eventos.map((e) => ({
          id: e.id,
          autor: e.autor,
          blob: e.blob,
          recibidoEn: e.recibido_en,
        })),
        cursor: r.datos.cursor,
        mas: r.datos.mas,
        cerradoEn: r.datos.cerrado_en,
      };
    }),
  };
}
