// Manejador de la Edge Function `compartido` (M16, docs/03-ARQUITECTURA.md §5.10 y §6, docs/05-MOTORES.md §E17):
// `POST /compartido/grupos`, `/codigo`, `/unirse`, `/salir`, `/eventos` y `GET /compartido/eventos`. El servidor
// solo ve blobs cifrados en el teléfono y su `grupo_id`, `id` y `autor`: nunca descifra nada ni guarda la llave.
// La pertenencia y el estado del grupo los decide la base (`compartido_*` en la migración `…_compartido.sql`), que
// se inyecta (`llamar`): la Edge Function usa `supabase.rpc`; las pruebas, PGlite con la migración real.
// Privacidad (regla 9): el registro lleva solo la ruta y el código; nunca usuarios, grupos, ids ni blobs.
import { z } from 'zod';
import type { Registrador } from '../nlu/registro.ts';

export const RUTAS_COMPARTIDO = ['grupos', 'codigo', 'unirse', 'salir', 'eventos'] as const;
export type RutaCompartido = (typeof RUTAS_COMPARTIDO)[number];

/** El código de unión vence en 10 minutos (03 §6). */
export const VIGENCIA_CODIGO_MS = 10 * 60 * 1000;
/** Bytes aleatorios del código de unión (base64url de 22 caracteres). */
export const BYTES_CODIGO = 16;
/** Eventos por publicación y por página de descarga. */
export const MAXIMO_EVENTOS_PUBLICAR = 50;
export const LIMITE_DESCARGA = 200;
/** Tope del blob en base64 (el mismo que aplica la tabla). */
export const LARGO_MAXIMO_BLOB = 4096;
export const CUERPO_MAXIMO = 256 * 1024;

export type FuncionCompartido =
  | 'compartido_crear'
  | 'compartido_codigo'
  | 'compartido_unirse'
  | 'compartido_salir'
  | 'compartido_publicar'
  | 'compartido_descargar';

export interface DependenciasCompartido {
  /** `false` si faltan las variables de Supabase: responde 503. */
  configurado: boolean;
  /** Id del usuario del JWT (sesión anónima o de correo); `null` si no es válido. */
  verificarUsuario(jwt: string): Promise<string | null>;
  /** Llama una función `public.compartido_*` con parámetros `p_*` y devuelve su `jsonb`. */
  llamar(funcion: FuncionCompartido, parametros: Record<string, unknown>): Promise<unknown>;
  aleatorio(n: number): Uint8Array;
  ahora(): number;
  registrar: Registrador;
}

export type CodigoCompartido =
  | 'metodo'
  | 'ruta'
  | 'sin_configurar'
  | 'no_autorizado'
  | 'solicitud_invalida'
  | 'no_miembro'
  | 'grupo_cerrado'
  | 'codigo_invalido'
  | 'ya_miembro'
  | 'conflicto'
  | 'error_interno';

export const ESTADO_COMPARTIDO: Record<CodigoCompartido, number> = {
  metodo: 405,
  ruta: 404,
  sin_configurar: 503,
  no_autorizado: 401,
  solicitud_invalida: 400,
  no_miembro: 403,
  grupo_cerrado: 403,
  codigo_invalido: 403,
  ya_miembro: 409,
  conflicto: 409,
  error_interno: 500,
};

const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const Uuid4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const CodigoUnion = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
const Blob = z
  .string()
  .min(56)
  .max(LARGO_MAXIMO_BLOB)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
/** Instante del servidor: `2026-10-12T15:30:00.123456Z` (lo arma `compartido_instante`). */
export const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

const SoloGrupo = z.strictObject({ grupo_id: Uuid });
const Unirse = z.strictObject({ grupo_id: Uuid, codigo_union: CodigoUnion });
const Publicar = z.strictObject({
  grupo_id: Uuid,
  eventos: z
    .array(z.strictObject({ id: Uuid4, blob: Blob }))
    .min(1)
    .max(MAXIMO_EVENTOS_PUBLICAR)
    .refine((es) => new Set(es.map((e) => e.id)).size === es.length, 'ids repetidos'),
});

const Respuesta = z.object({ codigo: z.string() }).passthrough();

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const ALFABETO_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url sin relleno (16 bytes → 22 caracteres). */
export function aBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += ALFABETO_URL[(n >> 18) & 63];
    s += ALFABETO_URL[(n >> 12) & 63];
    if (b !== undefined) s += ALFABETO_URL[(n >> 6) & 63];
    if (c !== undefined) s += ALFABETO_URL[n & 63];
  }
  return s;
}

/** SHA-256 en hexadecimal del código de unión: el servidor guarda solo esto. */
export async function hashCodigo(codigo: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function rutaDe(pathname: string): RutaCompartido | null {
  const m = /\/compartido\/(grupos|codigo|unirse|salir|eventos)\/?$/.exec(pathname);
  return m ? (m[1] as RutaCompartido) : null;
}

export function crearManejadorCompartido(deps: DependenciasCompartido): (req: Request) => Promise<Response> {
  return async (req) => {
    let endpoint = '/compartido';
    const registrar = (codigo: string, estado: number) =>
      deps.registrar({ usuario_hash: null, endpoint, codigo, estado_http: estado });
    const error = (codigo: CodigoCompartido) => {
      registrar(codigo, ESTADO_COMPARTIDO[codigo]);
      return responder(ESTADO_COMPARTIDO[codigo], { error: codigo });
    };
    const ok = (cuerpo: unknown) => {
      registrar('ok', 200);
      return responder(200, cuerpo);
    };

    try {
      const url = new URL(req.url);
      const ruta = rutaDe(url.pathname);
      if (ruta === null) return error('ruta');
      endpoint = `/compartido/${ruta}`;
      const metodos = ruta === 'eventos' ? ['GET', 'POST'] : ['POST'];
      if (!metodos.includes(req.method)) return error('metodo');
      if (!deps.configurado) return error('sin_configurar');

      const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
      if (jwt === undefined) return error('no_autorizado');
      const usuario = await deps.verificarUsuario(jwt).catch(() => null);
      if (usuario === null || !Uuid.safeParse(usuario).success) return error('no_autorizado');

      /** Llama la función y traduce su código; `null` si respondió `ok` (los datos van en `r`). */
      const llamar = async (funcion: FuncionCompartido, parametros: Record<string, unknown>) => {
        const r = Respuesta.safeParse(await deps.llamar(funcion, { p_usuario: usuario, ...parametros }));
        if (!r.success) throw new Error('respuesta');
        const codigo = r.data.codigo;
        if (codigo === 'ok') return { ok: true as const, datos: r.data as Record<string, unknown> };
        if (codigo in ESTADO_COMPARTIDO)
          return { ok: false as const, respuesta: error(codigo as CodigoCompartido) };
        throw new Error('codigo');
      };

      if (req.method === 'GET') {
        const grupo = Uuid.safeParse(url.searchParams.get('grupo_id'));
        const desde = url.searchParams.get('desde');
        if (!grupo.success || (desde !== null && !INSTANTE.test(desde))) return error('solicitud_invalida');
        const r = await llamar('compartido_descargar', {
          p_grupo: grupo.data,
          p_desde: desde,
          p_limite: LIMITE_DESCARGA,
        });
        if (!r.ok) return r.respuesta;
        return ok({
          eventos: r.datos.eventos,
          cursor: r.datos.cursor ?? null,
          mas: r.datos.mas === true,
          cerrado_en: r.datos.cerrado_en ?? null,
        });
      }

      const crudo = await req.text();
      if (new TextEncoder().encode(crudo).length > CUERPO_MAXIMO) return error('solicitud_invalida');
      let cuerpo: unknown;
      try {
        cuerpo = crudo === '' && ruta === 'grupos' ? {} : JSON.parse(crudo);
      } catch {
        return error('solicitud_invalida');
      }

      const nuevoCodigo = async () => {
        const codigo = aBase64Url(deps.aleatorio(BYTES_CODIGO));
        const venceEn = new Date(deps.ahora() + VIGENCIA_CODIGO_MS).toISOString();
        return { codigo, hash: await hashCodigo(codigo), venceEn };
      };

      switch (ruta) {
        case 'grupos': {
          if (!z.strictObject({}).safeParse(cuerpo).success) return error('solicitud_invalida');
          const c = await nuevoCodigo();
          const r = await llamar('compartido_crear', { p_codigo_hash: c.hash, p_vence_en: c.venceEn });
          if (!r.ok) return r.respuesta;
          return ok({ grupo_id: r.datos.grupo_id, codigo_union: c.codigo, vence_en: c.venceEn });
        }
        case 'codigo': {
          const s = SoloGrupo.safeParse(cuerpo);
          if (!s.success) return error('solicitud_invalida');
          const c = await nuevoCodigo();
          const r = await llamar('compartido_codigo', {
            p_grupo: s.data.grupo_id,
            p_codigo_hash: c.hash,
            p_vence_en: c.venceEn,
          });
          if (!r.ok) return r.respuesta;
          return ok({ codigo_union: c.codigo, vence_en: c.venceEn });
        }
        case 'unirse': {
          const s = Unirse.safeParse(cuerpo);
          if (!s.success) return error('solicitud_invalida');
          const r = await llamar('compartido_unirse', {
            p_grupo: s.data.grupo_id,
            p_codigo_hash: await hashCodigo(s.data.codigo_union),
          });
          if (!r.ok) return r.respuesta;
          return ok({ grupo_id: s.data.grupo_id, autor: r.datos.autor });
        }
        case 'salir': {
          const s = SoloGrupo.safeParse(cuerpo);
          if (!s.success) return error('solicitud_invalida');
          const r = await llamar('compartido_salir', { p_grupo: s.data.grupo_id });
          if (!r.ok) return r.respuesta;
          return ok({ cerrado_en: r.datos.cerrado_en });
        }
        case 'eventos': {
          const s = Publicar.safeParse(cuerpo);
          if (!s.success) return error('solicitud_invalida');
          const r = await llamar('compartido_publicar', {
            p_grupo: s.data.grupo_id,
            p_eventos: s.data.eventos,
          });
          if (!r.ok) return r.respuesta;
          return ok({ eventos: r.datos.eventos });
        }
      }
    } catch {
      // Nunca se registra el error: podría contener ids o blobs.
      registrar('error_interno', 500);
      return responder(500, { error: 'error_interno' });
    }
  };
}
