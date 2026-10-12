// Manejador de la Edge Function `respaldo` (M9, docs/03-ARQUITECTURA.md §5.7 y §6): `POST /respaldo/url`,
// `GET /respaldo/lista` y `DELETE /respaldo/cuenta`. El servidor solo guarda blobs `.cartera` que no puede abrir:
// nunca lee su contenido. Todo lo que toca red, Storage o Auth se inyecta (la Edge Function conecta Supabase; las
// pruebas, dobles). Privacidad (regla 9): el registro lleva solo ruta, operación y resultado; nunca el id del
// usuario, nombres de archivo ni tamaños.
import type { Registrador } from '../nlu/registro.ts';

export const RUTA_URL = '/respaldo/url';
export const RUTA_LISTA = '/respaldo/lista';
export const RUTA_CUENTA = '/respaldo/cuenta';

/** Se conservan los 4 respaldos más recientes por usuario (03 §5.7). */
export const MAXIMO_RESPALDOS = 4;
/** Tamaño máximo por archivo: 4 × 12.5 MB = 50 MB por usuario (03 §6). Lo aplica el bucket. */
export const TAMANO_MAXIMO_RESPALDO = 13_107_200;
/** Vigencia de la URL firmada de bajada (03 §6: 5 min). La de subida la fija Supabase (2 h). */
export const VIGENCIA_BAJADA_S = 300;
/** Las peticiones de `/respaldo/url` pesan unos bytes. */
export const CUERPO_MAXIMO_RESPALDO = 1024;
/** Versiones del formato `.cartera` aceptadas en el nombre (la valida `packages/respaldo` al abrirlo). */
export const VERSION_MAXIMA = 999;

/** `AAAAMMDDTHHMMSSZ-v<version>.cartera`: fecha UTC del servidor y versión del formato. */
export const NOMBRE_RESPALDO = /^(\d{8}T\d{6}Z)-v([1-9]\d{0,2})\.cartera$/;

/** Un objeto del bucket bajo el prefijo del usuario (`nombre` sin el prefijo). */
export interface ObjetoAlmacen {
  readonly nombre: string;
  readonly tamano: number;
  /** ISO 8601 (lo pone Storage). */
  readonly creado_en: string;
}

/** Storage con service role. Las rutas son siempre `<usuario>/<nombre>`; las arma el manejador, nunca el cliente. */
export interface AlmacenRespaldos {
  /** Todos los objetos bajo `<usuario>/` (también los que no tengan un nombre válido). */
  listar(usuarioId: string): Promise<ObjetoAlmacen[]>;
  /** URL firmada para subir (PUT) a una ruta que todavía no existe; no sobrescribe. */
  firmarSubida(ruta: string): Promise<string>;
  firmarBajada(ruta: string, segundos: number): Promise<string>;
  borrar(rutas: readonly string[]): Promise<void>;
}

export interface UsuarioVerificado {
  readonly id: string;
  /** `true` solo para una sesión con correo verificado (no anónima). */
  readonly conCorreo: boolean;
}

export interface DependenciasRespaldo {
  /** `false` si faltan las variables de Supabase: responde 503. */
  configurado: boolean;
  verificarUsuario(jwt: string): Promise<UsuarioVerificado | null>;
  almacen: AlmacenRespaldos;
  /** Elimina el usuario de Auth (correo incluido); `derechos` y `consentimiento` se van en cascada. */
  borrarUsuario(usuarioId: string): Promise<void>;
  ahora(): number;
  registrar: Registrador;
}

export interface RespaldoListado {
  readonly nombre: string;
  readonly tamano: number;
  readonly creado_en: string;
  readonly version: number;
}

export type CodigoRespaldo =
  | 'metodo'
  | 'ruta'
  | 'sin_configurar'
  | 'no_autorizado'
  | 'sin_correo'
  | 'solicitud_invalida'
  | 'no_encontrado'
  | 'ocupado'
  | 'error_interno';

export const ESTADO_RESPALDO: Record<CodigoRespaldo, number> = {
  metodo: 405,
  ruta: 404,
  sin_configurar: 503,
  no_autorizado: 401,
  sin_correo: 403,
  solicitud_invalida: 400,
  no_encontrado: 404,
  ocupado: 409,
  error_interno: 500,
};

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Nombre del respaldo nuevo con la hora del servidor: `20261012T153000Z-v1.cartera`. */
export function nombreRespaldo(ms: number, version: number): string {
  const iso = new Date(ms).toISOString(); // 2026-10-12T15:30:00.000Z
  const fecha = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`;
  const hora = `${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`;
  return `${fecha}T${hora}Z-v${version}.cartera`;
}

/**
 * Retención (CA-M9-04, parte servidor): de los objetos con nombre válido, los `MAXIMO_RESPALDOS` más recientes (por
 * la fecha del nombre, que pone el servidor) se conservan y el resto se borra. Un objeto con otro nombre no lo
 * creó el proxy: no se lista ni se poda (solo lo borra "borrar cuenta").
 */
export function podar(objetos: readonly ObjetoAlmacen[]): {
  conservar: RespaldoListado[];
  borrar: string[];
} {
  const validos: RespaldoListado[] = [];
  for (const o of objetos) {
    const m = NOMBRE_RESPALDO.exec(o.nombre);
    if (!m) continue;
    validos.push({ nombre: o.nombre, tamano: o.tamano, creado_en: o.creado_en, version: Number(m[2]) });
  }
  validos.sort((a, b) => (a.nombre < b.nombre ? 1 : a.nombre > b.nombre ? -1 : 0));
  return {
    conservar: validos.slice(0, MAXIMO_RESPALDOS),
    borrar: validos.slice(MAXIMO_RESPALDOS).map((o) => o.nombre),
  };
}

type Solicitud = { operacion: 'subir'; version: number } | { operacion: 'bajar'; nombre: string };

function leerSolicitud(cuerpo: unknown): Solicitud | null {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  const c = cuerpo as Record<string, unknown>;
  const claves = Object.keys(c).sort().join(',');
  if (c.operacion === 'subir' && claves === 'operacion,version') {
    const v = c.version;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= VERSION_MAXIMA) {
      return { operacion: 'subir', version: v };
    }
  }
  if (c.operacion === 'bajar' && claves === 'nombre,operacion') {
    if (typeof c.nombre === 'string' && NOMBRE_RESPALDO.test(c.nombre)) {
      return { operacion: 'bajar', nombre: c.nombre };
    }
  }
  return null;
}

function rutaDe(pathname: string): string | null {
  const m = /\/respaldo\/(url|lista|cuenta)\/?$/.exec(pathname);
  return m ? `/respaldo/${m[1]}` : null;
}

const METODO: Record<string, string> = { [RUTA_URL]: 'POST', [RUTA_LISTA]: 'GET', [RUTA_CUENTA]: 'DELETE' };

export function crearManejadorRespaldo(deps: DependenciasRespaldo): (req: Request) => Promise<Response> {
  return async (req) => {
    let endpoint = '/respaldo';
    let operacion = '';
    const registrar = (codigo: string, estado: number) =>
      deps.registrar({
        usuario_hash: null,
        endpoint,
        codigo: operacion ? `${operacion}:${codigo}` : codigo,
        estado_http: estado,
      });
    const error = (codigo: CodigoRespaldo) => {
      registrar(codigo, ESTADO_RESPALDO[codigo]);
      return responder(ESTADO_RESPALDO[codigo], { error: codigo });
    };
    const ok = (cuerpo: unknown) => {
      registrar('ok', 200);
      return responder(200, cuerpo);
    };

    try {
      const ruta = rutaDe(new URL(req.url).pathname);
      if (ruta === null) return error('ruta');
      endpoint = ruta;
      if (req.method !== METODO[ruta]) return error('metodo');
      if (!deps.configurado) return error('sin_configurar');

      const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
      if (jwt === undefined) return error('no_autorizado');
      const usuario = await deps.verificarUsuario(jwt).catch(() => null);
      if (usuario === null) return error('no_autorizado');
      // Solo una cuenta de respaldo (sesión de correo) usa el bucket; la sesión anónima no (03 §6).
      if (!usuario.conCorreo) return error('sin_correo');
      const prefijo = `${usuario.id}/`;

      if (ruta === RUTA_LISTA) {
        operacion = 'lista';
        const { conservar, borrar } = podar(await deps.almacen.listar(usuario.id));
        if (borrar.length > 0) {
          // Si la poda falla, la lista sigue sirviendo (por ejemplo, para restaurar); se reintenta en la siguiente.
          await deps.almacen.borrar(borrar.map((n) => prefijo + n)).catch(() => registrar('poda_fallo', 200));
        }
        return ok({ respaldos: conservar });
      }

      if (ruta === RUTA_CUENTA) {
        operacion = 'cuenta';
        // De punta a punta (CA-M9-07): primero todos los archivos del prefijo; si alguno queda, no se borra el
        // usuario y el cliente reintenta. Después el usuario de Auth (su correo).
        for (let intento = 0; intento < 3; intento++) {
          const objetos = await deps.almacen.listar(usuario.id);
          if (objetos.length === 0) break;
          await deps.almacen.borrar(objetos.map((o) => prefijo + o.nombre));
        }
        if ((await deps.almacen.listar(usuario.id)).length > 0) return error('error_interno');
        await deps.borrarUsuario(usuario.id);
        return ok({ resultado: 'borrada' });
      }

      const crudo = await req.text();
      if (new TextEncoder().encode(crudo).length > CUERPO_MAXIMO_RESPALDO) return error('solicitud_invalida');
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(crudo);
      } catch {
        return error('solicitud_invalida');
      }
      const solicitud = leerSolicitud(cuerpo);
      if (solicitud === null) return error('solicitud_invalida');
      operacion = solicitud.operacion;

      const { conservar, borrar } = podar(await deps.almacen.listar(usuario.id));
      if (solicitud.operacion === 'bajar') {
        if (!conservar.some((o) => o.nombre === solicitud.nombre)) return error('no_encontrado');
        const url = await deps.almacen.firmarBajada(prefijo + solicitud.nombre, VIGENCIA_BAJADA_S);
        return ok({ nombre: solicitud.nombre, url });
      }

      // Subir: antes de firmar se poda a 4 (si falla, no se firma: nunca más de 5 archivos por usuario). El nombre
      // lo pone el servidor; después de subir, el cliente llama a la lista, que poda al quinto.
      if (borrar.length > 0) await deps.almacen.borrar(borrar.map((n) => prefijo + n));
      const nombre = nombreRespaldo(deps.ahora(), solicitud.version);
      if (conservar.some((o) => o.nombre === nombre)) return error('ocupado');
      const url = await deps.almacen.firmarSubida(prefijo + nombre);
      return ok({ nombre, url, tamano_maximo: TAMANO_MAXIMO_RESPALDO });
    } catch {
      // Nunca se registra el error: podría contener ids o rutas.
      registrar('error_interno', 500);
      return responder(500, { error: 'error_interno' });
    }
  };
}
