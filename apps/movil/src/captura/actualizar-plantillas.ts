/**
 * Descarga y activación de plantillas remotas (`docs/07-CAPTURA.md §3.1`, `03 §5.8`). Una vez al día (al abrir la
 * app) se pide `plantillas.json` al bucket público con `If-None-Match` y su `.sig`; se acepta solo si la firma
 * verifica con una llave embebida, la versión es mayor que la registrada y la app cumple `version_minima_app`.
 *
 * Dónde vive cada cosa: la tabla `plantilla_remota` (migración `0003`) registra versión, SHA-256, firma, cuándo
 * llegó y cuál está activa; los bytes del archivo activo van en el ajuste `plantillas_remotas` (la tabla no tiene
 * columna de contenido) y la revisión diaria en `plantillas_remotas_revision` (instante, ETag y el código del
 * último resultado, nunca contenido). Todo se escribe en una sola transacción SQLite. Al cargar se vuelve a
 * verificar: un contenido alterado en la base o firmado con una llave que la app ya no trae no se usa.
 *
 * Fallos de red, firma inválida o archivo inválido: se conserva lo anterior (o las embebidas). Nada en logs.
 */
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { esquema } from '@cartera/datos';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { conTiempo, type FetchNube } from '../nube/http';
import { enTransaccion, type Contexto } from '../servicios/contexto';
import { escribirAjuste, leerAjuste } from '../servicios/preferencias';
import {
  verificarPlantillasRemotas,
  type ArchivoRemoto,
  type LlavePlantillas,
  type MotivoRechazo,
} from './plantillas-remotas';

const { plantillaRemota } = esquema;

const CLAVE_CONTENIDO = 'plantillas_remotas';
const CLAVE_REVISION = 'plantillas_remotas_revision';
const CADA_MS = 24 * 60 * 60 * 1000;
const TIEMPO_MS = 15_000;
/** Las embebidas son la versión 1 (`07 §3.1`). */
const VERSION_EMBEBIDA = 1;

const Contenido = z.strictObject({ version: z.int().positive(), contenido: z.string() });
const Revision = z.strictObject({
  revisadas_en: z.int().nonnegative(),
  etag: z.string().nullable(),
  ultimo_resultado: z.string(),
});

export interface OpcionesPlantillas {
  readonly llaves: readonly LlavePlantillas[];
  /** `expo.version` de la app (`x.y.z`). */
  readonly versionApp: string;
}

export interface DependenciasPlantillas extends OpcionesPlantillas {
  readonly fetch: FetchNube;
  /** URL de `plantillas.json`; la firma está en `<url>.sig`. */
  readonly url: string;
}

export type ResultadoActualizacion =
  | { readonly tipo: 'aceptada'; readonly version: number; readonly archivo: ArchivoRemoto }
  | { readonly tipo: 'rechazada'; readonly motivo: MotivoRechazo | 'respuesta_invalida' }
  /** 304: el archivo no cambió. */
  | { readonly tipo: 'sin_cambios' }
  /** Ya se revisó en las últimas 24 h. */
  | { readonly tipo: 'no_toca' }
  | { readonly tipo: 'sin_red' }
  /** El build no trae llaves: no se descarga nada y quedan las embebidas. */
  | { readonly tipo: 'sin_llaves' };

/** `plantillas.json` en el bucket público `plantillas` del proyecto (`07 §3.1`). */
export function urlPlantillas(urlSupabase: string): string {
  return `${urlSupabase.replace(/\/+$/, '')}/storage/v1/object/public/plantillas/plantillas.json`;
}

function filaActiva(ctx: Contexto) {
  return ctx.db.select().from(plantillaRemota).where(eq(plantillaRemota.activa, 1)).get() ?? null;
}

function ultimaRegistrada(ctx: Contexto) {
  return ctx.db.select().from(plantillaRemota).orderBy(desc(plantillaRemota.version)).limit(1).get() ?? null;
}

function leerSeguro<T>(ctx: Contexto, clave: string, forma: z.ZodType<T>): T | null {
  try {
    return leerAjuste(ctx, clave, forma);
  } catch {
    return null;
  }
}

/**
 * Archivo remoto activo, verificado otra vez (firma con las llaves de este build, SHA-256 registrado, forma y
 * RegExp). `null` = solo las embebidas.
 */
export function plantillasActivas(ctx: Contexto, opciones: OpcionesPlantillas): ArchivoRemoto | null {
  const fila = filaActiva(ctx);
  const guardado = leerSeguro(ctx, CLAVE_CONTENIDO, Contenido);
  if (!fila || !guardado || guardado.version !== fila.version) return null;
  const r = verificarPlantillasRemotas({
    bytes: utf8ToBytes(guardado.contenido),
    firmaBase64: fila.firma,
    llaves: opciones.llaves,
    versionActiva: 0,
    versionApp: opciones.versionApp,
  });
  return r.ok && r.version === fila.version && r.sha256 === fila.sha256 ? r.archivo : null;
}

function registrarRevision(ctx: Contexto, etag: string | null, resultado: string): void {
  escribirAjuste(ctx, CLAVE_REVISION, Revision, {
    revisadas_en: ctx.reloj.ahora(),
    etag,
    ultimo_resultado: resultado,
  });
}

async function bajar(
  deps: DependenciasPlantillas,
  etag: string | null,
): Promise<
  { tipo: 'sin_cambios' } | { tipo: 'archivo'; bytes: Uint8Array; firma: string; etag: string | null } | null
> {
  return conTiempo(TIEMPO_MS, async (signal) => {
    const r = await deps.fetch(deps.url, {
      method: 'GET',
      headers: etag ? { 'If-None-Match': etag } : {},
      signal,
    });
    if (r.status === 304) return { tipo: 'sin_cambios' as const };
    if (r.status !== 200) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const nuevaEtag = r.headers?.get('etag') ?? null;
    const f = await deps.fetch(`${deps.url}.sig`, { method: 'GET', headers: {}, signal });
    if (f.status !== 200) return null;
    const firmaBytes = new Uint8Array(await f.arrayBuffer());
    // La firma es base64 (ASCII); cualquier otro byte la invalida en la verificación.
    let firma = '';
    for (const b of firmaBytes) firma += String.fromCharCode(b);
    return { tipo: 'archivo' as const, bytes, firma, etag: nuevaEtag };
  });
}

/**
 * Revisa el archivo remoto si toca (o con `forzar`) y, si es válido y más nuevo, lo activa. Devuelve qué pasó;
 * quien llama aplica el archivo aceptado al catálogo y al módulo nativo.
 */
export async function actualizarPlantillasRemotas(
  ctx: Contexto,
  deps: DependenciasPlantillas,
  opciones: { readonly forzar?: boolean } = {},
): Promise<ResultadoActualizacion> {
  if (deps.llaves.length === 0) return { tipo: 'sin_llaves' };
  const revision = leerSeguro(ctx, CLAVE_REVISION, Revision);
  if (!opciones.forzar && revision && ctx.reloj.ahora() - revision.revisadas_en < CADA_MS) {
    return { tipo: 'no_toca' };
  }

  const activa = plantillasActivas(ctx, deps);
  const registrada = ultimaRegistrada(ctx);
  // El ETag solo vale si el archivo activo sigue en la base; si se perdió, se baja completo.
  const etag = activa ? (revision?.etag ?? null) : null;

  let respuesta: Awaited<ReturnType<typeof bajar>>;
  try {
    respuesta = await bajar(deps, etag);
  } catch {
    return { tipo: 'sin_red' };
  }
  if (respuesta === null) {
    registrarRevision(ctx, null, 'respuesta_invalida');
    return { tipo: 'rechazada', motivo: 'respuesta_invalida' };
  }
  if (respuesta.tipo === 'sin_cambios') {
    registrarRevision(ctx, etag, 'sin_cambios');
    return { tipo: 'sin_cambios' };
  }

  const r = verificarPlantillasRemotas({
    bytes: respuesta.bytes,
    firmaBase64: respuesta.firma,
    llaves: deps.llaves,
    versionActiva: Math.max(VERSION_EMBEBIDA, registrada?.version ?? 0),
    versionApp: deps.versionApp,
    recuperar: !activa && registrada ? { version: registrada.version, sha256: registrada.sha256 } : undefined,
  });
  if (!r.ok) {
    // Sin ETag: un archivo rechazado (p. ej., por versión de la app) se vuelve a evaluar mañana.
    registrarRevision(ctx, null, r.motivo);
    return { tipo: 'rechazada', motivo: r.motivo };
  }

  enTransaccion(ctx, () => {
    const ahora = ctx.reloj.ahora();
    ctx.db.update(plantillaRemota).set({ activa: 0 }).where(eq(plantillaRemota.activa, 1)).run();
    ctx.db
      .insert(plantillaRemota)
      .values({ version: r.version, sha256: r.sha256, firma: r.firma, recibidaEn: ahora, activa: 1 })
      .onConflictDoUpdate({ target: plantillaRemota.version, set: { activa: 1 } })
      .run();
    escribirAjuste(ctx, CLAVE_CONTENIDO, Contenido, { version: r.version, contenido: r.contenido });
    registrarRevision(ctx, respuesta.etag, 'aceptada');
  });
  return { tipo: 'aceptada', version: r.version, archivo: r.archivo };
}
