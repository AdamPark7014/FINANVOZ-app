import { TIEMPO_MAXIMO_MS } from '@cartera/nlu';
import type { AlmacenSeguro } from '../db/llave';
import { conTiempo, type FetchNube, fetchPlataforma, jsonDe } from './http';
import { CLAVE_SESION_NUBE, guardarSesionAuth, type SesionNube } from './sesion';
import { type ClaimsSesion, claimsDeToken } from './token';

/**
 * Cuenta de respaldo con correo y código (M9, `02 §19`, `03 §5.7`): Supabase Auth con `fetch` directo (sin SDK).
 *
 * - **Vincular** (el caso normal): la app ya tiene una sesión anónima (`sesion.ts`). `PUT /auth/v1/user {email}`
 *   con su JWT manda el código al correo y `POST /auth/v1/verify {type: 'email_change'}` lo confirma: el **mismo
 *   usuario** (`usuario_id`) queda con correo, así que conserva su plan (`derechos`), su cupo y su evidencia de
 *   consentimiento.
 * - **Entrar** (teléfono nuevo o ese correo ya tiene cuenta): Auth responde `email_exists` al vincular; entonces
 *   `POST /auth/v1/otp {create_user: false}` y `POST /auth/v1/verify {type: 'email'}` abren la sesión del usuario
 *   original. El anónimo de este teléfono queda sin usar (no tenía respaldos ni compras propias).
 *
 * En los dos casos la sesión resultante reemplaza a la guardada en el almacén seguro (`CLAVE_SESION_NUBE`): desde
 * ahí el intérprete, RevenueCat y el respaldo usan ese usuario. Nada de esto se registra (regla 9): ni el correo,
 * ni el código, ni los tokens.
 */
export interface CuentaRespaldo {
  /** Sesión actual (con o sin correo); `null` si no hay forma de obtenerla. */
  estado(): Promise<ClaimsSesion | null>;
  /**
   * Manda el código de un solo uso al correo. `modo` se pasa tal cual a `verificarCodigo`. Con `soloEntrar`
   * (restaurar en un teléfono nuevo) va directo a "entrar": no crea ni toca la sesión anónima de este teléfono.
   */
  pedirCodigo(
    correo: string,
    opciones?: { readonly soloEntrar?: boolean },
  ): Promise<ResultadoCuenta<{ modo: ModoCodigo }>>;
  /** Confirma el código; la sesión de correo queda guardada. */
  verificarCodigo(correo: string, codigo: string, modo: ModoCodigo): Promise<ResultadoCuenta<ClaimsSesion>>;
  /**
   * Olvida la sesión guardada (después de borrar la cuenta de respaldo en el servidor): la siguiente petición a la
   * nube crea un usuario anónimo nuevo.
   */
  olvidarSesion(): Promise<void>;
}

export type ModoCodigo = 'vincular' | 'entrar';

export type ErrorCuenta =
  | 'sin_red'
  | 'correo_invalido'
  | 'codigo_invalido'
  /** Auth limita los correos y los intentos por hora. */
  | 'demasiados_intentos'
  /** Se quiso entrar con un correo que no tiene cuenta. */
  | 'sin_cuenta'
  /** No hay sesión anónima que vincular (Auth la rechazó). */
  | 'sin_sesion'
  | 'servidor';

export type ResultadoCuenta<T> = ({ ok: true } & T) | { ok: false; error: ErrorCuenta };

export interface OpcionesCuentaRespaldo {
  /** `https://<ref>.supabase.co` */
  readonly url: string;
  /** Llave pública `anon` del proyecto. */
  readonly llaveAnonima: string;
  readonly almacen: AlmacenSeguro;
  readonly sesion: SesionNube;
  readonly fetch?: FetchNube;
  readonly ahora?: () => number;
}

const CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
/** Supabase manda 6 dígitos por omisión (`02 §19`); el proyecto puede configurar hasta 10. */
const CODIGO = /^\d{6,10}$/;

export function normalizarCorreo(correo: string): string | null {
  const c = correo.trim().toLowerCase();
  return c.length <= 254 && CORREO.test(c) ? c : null;
}

/** Código de error de una respuesta de GoTrue (`error_code`, o `code`/`error` en versiones viejas). */
function codigoAuth(cuerpo: unknown): string {
  if (!cuerpo || typeof cuerpo !== 'object') return '';
  const c = cuerpo as Record<string, unknown>;
  const codigo = c.error_code ?? c.code ?? c.error;
  return typeof codigo === 'string' ? codigo : '';
}

function correoYaRegistrado(estado: number, cuerpo: unknown): boolean {
  if (estado !== 422 && estado !== 400) return false;
  if (codigoAuth(cuerpo) === 'email_exists') return true;
  const msg = (cuerpo as { msg?: unknown } | null)?.msg;
  return typeof msg === 'string' && /already been registered/i.test(msg);
}

export function crearCuentaRespaldo(opciones: OpcionesCuentaRespaldo): CuentaRespaldo {
  const base = opciones.url.replace(/\/+$/, '');
  const ahora = opciones.ahora ?? (() => Date.now());
  const fetchNube = opciones.fetch ?? fetchPlataforma;

  const auth = (metodo: 'POST' | 'PUT', ruta: string, cuerpo: unknown, jwt?: string) =>
    conTiempo(TIEMPO_MAXIMO_MS, (signal) =>
      fetchNube(`${base}/auth/v1${ruta}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          apikey: opciones.llaveAnonima,
          Authorization: `Bearer ${jwt ?? opciones.llaveAnonima}`,
        },
        body: JSON.stringify(cuerpo),
        signal,
      }),
    );

  const errorDe = (estado: number, deCodigo: ErrorCuenta): ErrorCuenta =>
    estado === 429 ? 'demasiados_intentos' : estado >= 500 ? 'servidor' : deCodigo;

  async function enviarOtp(correo: string): Promise<ResultadoCuenta<{ modo: ModoCodigo }>> {
    const r = await auth('POST', '/otp', { email: correo, create_user: false });
    if (r.status >= 200 && r.status < 300) return { ok: true, modo: 'entrar' };
    // Con `create_user: false`, un correo sin cuenta da 4xx (`otp_disabled` / "Signups not allowed").
    return { ok: false, error: errorDe(r.status, 'sin_cuenta') };
  }

  return {
    async estado() {
      const token = await opciones.sesion.obtenerToken().catch(() => null);
      return token ? claimsDeToken(token) : null;
    },

    async pedirCodigo(correoCrudo, opcionesCodigo) {
      const correo = normalizarCorreo(correoCrudo);
      if (correo === null) return { ok: false, error: 'correo_invalido' };
      try {
        if (opcionesCodigo?.soloEntrar) return await enviarOtp(correo);
        const token = await opciones.sesion.obtenerToken();
        if (token === null) return { ok: false, error: 'sin_sesion' };
        // Ya es una sesión de correo (otra cuenta o la misma): entrar con el código.
        if (claimsDeToken(token)?.conCorreo) return await enviarOtp(correo);
        const r = await auth('PUT', '/user', { email: correo }, token);
        if (r.status >= 200 && r.status < 300) return { ok: true, modo: 'vincular' };
        const cuerpo = await jsonDe(r);
        if (correoYaRegistrado(r.status, cuerpo)) return await enviarOtp(correo);
        if (r.status === 401 || r.status === 403) return { ok: false, error: 'sin_sesion' };
        return { ok: false, error: errorDe(r.status, 'correo_invalido') };
      } catch {
        return { ok: false, error: 'sin_red' };
      }
    },

    async verificarCodigo(correoCrudo, codigoCrudo, modo) {
      const correo = normalizarCorreo(correoCrudo);
      if (correo === null) return { ok: false, error: 'correo_invalido' };
      const codigo = codigoCrudo.replace(/\s+/g, '');
      if (!CODIGO.test(codigo)) return { ok: false, error: 'codigo_invalido' };
      try {
        const r = await auth('POST', '/verify', {
          type: modo === 'vincular' ? 'email_change' : 'email',
          email: correo,
          token: codigo,
        });
        if (r.status < 200 || r.status >= 300) {
          return { ok: false, error: errorDe(r.status, 'codigo_invalido') };
        }
        const guardada = guardarSesionAuth(opciones.almacen, await jsonDe(r), ahora());
        const claims = guardada ? claimsDeToken(guardada.access_token) : null;
        if (!claims?.conCorreo) return { ok: false, error: 'servidor' };
        return { ok: true, ...claims };
      } catch {
        return { ok: false, error: 'sin_red' };
      }
    },

    async olvidarSesion() {
      await opciones.almacen.borrar(CLAVE_SESION_NUBE);
    },
  };
}
