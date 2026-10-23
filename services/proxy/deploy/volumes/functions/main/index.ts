// Enrutador `main` del edge-runtime del backend de FinanVoz. Adaptado de supabase/supabase
// docker/volumes/functions/main/index.ts (octubre de 2026) con tres cambios para servir las funciones del repo
// tal como en Supabase Cloud:
//   1. verify_jwt por función: FUNCIONES_SIN_JWT (coma) = las de supabase/config.toml con verify_jwt = false.
//   2. Mapa de importaciones por función: <función>/deno.json si existe (el oficial usa uno común).
//   3. FUNCIONES_URL_PUBLICA (coma): esas funciones reciben SUPABASE_PUBLIC_URL como SUPABASE_URL, porque firman
//      URLs de Storage que usa el teléfono (`respaldo`). Las demás hablan con Kong por la red interna.
// Solo registra el nombre de la función y códigos de error, nunca cuerpos ni encabezados (regla 9).
import * as jose from 'jsr:@panva/jose@6';

const MAX_REINTENTOS = 3;
const RAIZ = '/home/deno/functions';

const env = (nombre: string) => Deno.env.get(nombre)?.trim() ?? '';
const lista = (nombre: string) =>
  new Set(
    env(nombre)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const JWT_SECRET = env('JWT_SECRET');
const VERIFY_JWT = env('VERIFY_JWT') === 'true';
const SIN_JWT = lista('FUNCIONES_SIN_JWT');
const URL_PUBLICA = lista('FUNCIONES_URL_PUBLICA');
const SUPABASE_PUBLIC_URL = env('SUPABASE_PUBLIC_URL');
// Variables que solo usa este enrutador y no necesita ninguna función.
const SOLO_ENRUTADOR = new Set(['JWT_SECRET', 'VERIFY_JWT', 'FUNCIONES_SIN_JWT', 'FUNCIONES_URL_PUBLICA']);

function error(estado: number, code: string, message: string): Response {
  return Response.json(
    { code, message, msg: message },
    { status: estado, headers: { 'sb-error-code': code, 'Access-Control-Expose-Headers': 'sb-error-code' } },
  );
}

function tokenDe(req: Request): string | null {
  const partes = (req.headers.get('authorization') ?? '').trim().split(/\s+/);
  if (partes.length !== 2 || partes[0]?.toLowerCase() !== 'bearer' || !partes[1]) return null;
  return partes[1];
}

async function jwtValido(jwt: string): Promise<boolean> {
  if (!JWT_SECRET) return false;
  try {
    if (jose.decodeProtectedHeader(jwt).alg !== 'HS256') return false;
    await jose.jwtVerify(jwt, new TextEncoder().encode(JWT_SECRET));
    return true;
  } catch {
    return false;
  }
}

async function existe(ruta: string, tipo: 'archivo' | 'carpeta'): Promise<boolean> {
  try {
    const info = await Deno.stat(ruta);
    return tipo === 'carpeta' ? info.isDirectory : info.isFile;
  } catch {
    return false;
  }
}

function respuestaDelTrabajador(r: Response): Response {
  if (r.status < 500) return r;
  const headers = new Headers(r.headers);
  headers.set('sb-error-code', 'EDGE_FUNCTION_ERROR');
  headers.set('Access-Control-Expose-Headers', 'sb-error-code');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
}

console.log('main: enrutador listo');

Deno.serve(async (req: Request) => {
  const nombre = new URL(req.url).pathname.split('/')[1] ?? '';
  // `_shared` y `main` no son funciones; tampoco nada con caracteres raros.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(nombre) || nombre === 'main') {
    return error(404, 'NOT_FOUND', 'Requested function was not found');
  }
  const ruta = `${RAIZ}/${nombre}`;
  if (!(await existe(`${ruta}/index.ts`, 'archivo'))) {
    return error(404, 'NOT_FOUND', 'Requested function was not found');
  }

  if (req.method !== 'OPTIONS' && VERIFY_JWT && !SIN_JWT.has(nombre)) {
    const jwt = tokenDe(req);
    if (!jwt) return error(401, 'UNAUTHORIZED_NO_AUTH_HEADER', 'Missing authorization header');
    if (!(await jwtValido(jwt))) return error(401, 'UNAUTHORIZED_LEGACY_JWT', 'Invalid JWT');
  }

  const variables: Record<string, string> = { ...Deno.env.toObject(), SUPABASE_FUNCTION_SLUG: nombre };
  if (URL_PUBLICA.has(nombre) && SUPABASE_PUBLIC_URL) variables.SUPABASE_URL = SUPABASE_PUBLIC_URL;
  const envVars = Object.entries(variables).filter(([k]) => !SOLO_ENRUTADOR.has(k));
  const mapa = `${ruta}/deno.json`;
  const importMapPath = (await existe(mapa, 'archivo')) ? mapa : null;

  const llamar = async (req: Request, quedan = MAX_REINTENTOS): Promise<Response> => {
    const copia = quedan > 0 ? req.clone() : null;
    try {
      const trabajador = await EdgeRuntime.userWorkers.create({
        servicePath: ruta,
        memoryLimitMb: 150,
        workerTimeoutMs: 400_000,
        context: { supervisor: { requestAbsentTimeoutMs: 60_000 } },
        noModuleCache: false,
        importMapPath,
        envVars,
      });
      const peticion = new Request(req);
      peticion.headers.delete('sb-api-key');
      EdgeRuntime.applySupabaseTag(req, peticion);
      return respuestaDelTrabajador(await trabajador.fetch(peticion));
    } catch (e) {
      if (e instanceof Deno.errors.WorkerAlreadyRetired && copia) {
        EdgeRuntime.applySupabaseTag(req, copia);
        return await llamar(copia, quedan - 1);
      }
      const tipo = e instanceof Error ? e.constructor.name : 'desconocido';
      console.error(`main: ${nombre} falló (${tipo})`);
      if (e instanceof Deno.errors.InvalidWorkerCreation) {
        return error(503, 'BOOT_ERROR', 'Function failed to start (please check logs)');
      }
      if (e instanceof Deno.errors.WorkerRequestIdleTimeout) {
        return error(504, 'IDLE_TIMEOUT', 'Request idle timeout limit (150s) reached');
      }
      if (e instanceof Deno.errors.WorkerRequestCancelled) {
        return error(
          546,
          'WORKER_RESOURCE_LIMIT',
          'Function failed due to not having enough compute resources',
        );
      }
      return error(500, 'WORKER_ERROR', 'Function exited due to an error (please check logs)');
    }
  };

  return await llamar(req);
});
