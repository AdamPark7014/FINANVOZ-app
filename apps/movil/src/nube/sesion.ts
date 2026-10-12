import { z } from 'zod';
import { TIEMPO_MAXIMO_MS, type Transporte } from '@cartera/nlu';
import type { AlmacenSeguro } from '../db/llave';

/**
 * Sesión con el proxy (`03 §6`): JWT de una sesión anónima de Supabase creada la primera vez que hace falta.
 * La app solo necesita `obtenerToken`; quién lo emite queda detrás de esta interfaz.
 */
export interface SesionNube {
  /** JWT vigente; `renovar` fuerza uno nuevo (tras un 401). `null` si no hay forma de obtenerlo. */
  obtenerToken(opciones?: { renovar?: boolean }): Promise<string | null>;
}

/** Llave del almacén seguro con los tokens de la sesión anónima. "Borrar todo" la elimina. */
export const CLAVE_SESION_NUBE = 'cartera.nube.sesion.v1';

/** Margen para renovar antes de que venza el token. */
const MARGEN_MS = 60_000;

const Guardada = z.strictObject({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  /** Vencimiento del access token, ms UTC. */
  vence_en: z.number().int(),
});
export type Guardada = z.infer<typeof Guardada>;

const RespuestaAuth = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
});

/**
 * Guarda en el almacén seguro la sesión de una respuesta de Supabase Auth (`/signup`, `/token`, `/verify`).
 * Devuelve `null` si la respuesta no trae una sesión. La usan esta sesión y la cuenta de respaldo
 * (`cuenta-respaldo.ts`): al vincular el correo o entrar con él, la sesión de la app pasa a ser la de correo.
 */
export function guardarSesionAuth(almacen: AlmacenSeguro, cuerpo: unknown, ahoraMs: number): Guardada | null {
  const datos = RespuestaAuth.safeParse(cuerpo);
  if (!datos.success) return null;
  const guardada: Guardada = {
    access_token: datos.data.access_token,
    refresh_token: datos.data.refresh_token,
    vence_en: ahoraMs + Math.floor(datos.data.expires_in * 1000),
  };
  almacen.guardar(CLAVE_SESION_NUBE, JSON.stringify(guardada));
  return guardada;
}

export interface OpcionesSesionNube {
  /** `https://<ref>.supabase.co` */
  readonly url: string;
  /** Llave pública `anon` del proyecto (no es un secreto: la protege la RLS y el JWT). */
  readonly llaveAnonima: string;
  readonly almacen: AlmacenSeguro;
  readonly transporte?: Transporte;
  readonly ahora?: () => number;
}

/**
 * Sesión anónima de Supabase Auth con `fetch` directo (sin SDK): `POST /auth/v1/signup` con la llave `anon`
 * crea el usuario anónimo; `POST /auth/v1/token?grant_type=refresh_token` renueva. Los tokens viven en el
 * almacén seguro. Ningún token ni respuesta se registra (regla 9). Si no hay red, `obtenerToken` rechaza y el
 * cliente lo trata como `sin_red`.
 */
export function crearSesionNube(opciones: OpcionesSesionNube): SesionNube {
  const base = opciones.url.replace(/\/+$/, '');
  const ahora = opciones.ahora ?? (() => Date.now());
  const transporte: Transporte = opciones.transporte ?? ((url, p) => globalThis.fetch(url, p));
  let enCurso: Promise<string | null> | null = null;

  const leer = (): Guardada | null => {
    const crudo = opciones.almacen.obtener(CLAVE_SESION_NUBE);
    if (crudo === null) return null;
    try {
      return Guardada.parse(JSON.parse(crudo));
    } catch {
      return null;
    }
  };

  async function pedir(ruta: string, cuerpo: unknown): Promise<Guardada | null> {
    const control = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        control.abort();
        rechazar(new Error('tiempo_agotado'));
      }, TIEMPO_MAXIMO_MS);
    });
    const r = await Promise.race([
      transporte(`${base}${ruta}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: opciones.llaveAnonima,
          Authorization: `Bearer ${opciones.llaveAnonima}`,
        },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      }),
      limite,
    ]).finally(() => clearTimeout(temporizador));
    if (r.status < 200 || r.status >= 300) return null;
    return guardarSesionAuth(opciones.almacen, await r.json().catch(() => null), ahora());
  }

  async function obtener(renovar: boolean): Promise<string | null> {
    const actual = leer();
    if (actual && !renovar && actual.vence_en - MARGEN_MS > ahora()) return actual.access_token;
    if (actual) {
      const renovada = await pedir('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: actual.refresh_token,
      });
      if (renovada) return renovada.access_token;
    }
    // Sin sesión (o el refresh ya no sirve): usuario anónimo nuevo.
    const nueva = await pedir('/auth/v1/signup', { data: {} });
    return nueva?.access_token ?? null;
  }

  return {
    obtenerToken(o) {
      // Una sola petición a la vez: dos frases seguidas no crean dos usuarios anónimos.
      enCurso ??= obtener(o?.renovar === true).finally(() => {
        enCurso = null;
      });
      return enCurso;
    },
  };
}
