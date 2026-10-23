/**
 * Lectura y escritura de grabaciones del nivel nube (solo Node; no se exporta desde el paquete).
 * Formato: `fixtures/nlu/grabaciones/<proveedor>/<modelo>.jsonl`, una `Grabacion` por línea, ordenadas por id.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Grabacion, Precio } from './nube';

export const DIRECTORIO_GRABACIONES = fileURLToPath(
  new URL('../../../../fixtures/nlu/grabaciones', import.meta.url),
);
const PRECIOS = fileURLToPath(new URL('../../../../config/nlu/precios.json', import.meta.url));

const CAMPOS = [
  'id',
  'proveedor',
  'modelo',
  'codigo',
  'interpretacion',
  'tokens_entrada',
  'tokens_salida',
  // Opcionales: las grabaciones viejas no los traen (el costo las cobra a precio de entrada).
  'tokens_cache_leidos',
  'tokens_cache_escritos',
  'latencia_ms',
] as const;

/** Nombre de archivo seguro para un modelo (`gpt-5-mini` → `gpt-5-mini.jsonl`). */
export const archivoModelo = (modelo: string) => `${modelo.replace(/[^\w.-]/g, '_')}.jsonl`;

function validarGrabacion(v: unknown, origen: string): Grabacion {
  const g = v as Record<string, unknown>;
  const ok =
    typeof g === 'object' &&
    g !== null &&
    typeof g.id === 'string' &&
    typeof g.proveedor === 'string' &&
    typeof g.modelo === 'string' &&
    typeof g.codigo === 'string' &&
    (g.interpretacion === null ||
      (typeof g.interpretacion === 'object' && !Array.isArray(g.interpretacion))) &&
    Number.isFinite(g.tokens_entrada) &&
    Number.isFinite(g.tokens_salida) &&
    Number.isFinite(g.latencia_ms);
  if (!ok) throw new Error(`grabación mal formada en ${origen}`);
  return g as unknown as Grabacion;
}

export function leerArchivoGrabaciones(ruta: string): Grabacion[] {
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l, i) => validarGrabacion(JSON.parse(l), `${ruta}:${i + 1}`));
}

/** Todas las grabaciones del directorio: `[{ ruta, grabaciones }]` por proveedor y modelo, en orden alfabético. */
export function listarGrabaciones(
  directorio = DIRECTORIO_GRABACIONES,
): { ruta: string; grabaciones: Grabacion[] }[] {
  if (!existsSync(directorio)) return [];
  const salida: { ruta: string; grabaciones: Grabacion[] }[] = [];
  for (const proveedor of readdirSync(directorio).sort()) {
    const dir = join(directorio, proveedor);
    if (!statSync(dir).isDirectory()) continue;
    for (const archivo of readdirSync(dir).sort()) {
      if (!archivo.endsWith('.jsonl')) continue;
      const ruta = join(dir, archivo);
      salida.push({ ruta, grabaciones: leerArchivoGrabaciones(ruta) });
    }
  }
  return salida;
}

export function escribirGrabaciones(
  grabaciones: readonly Grabacion[],
  directorio = DIRECTORIO_GRABACIONES,
): string {
  const primera = grabaciones[0];
  if (primera === undefined) throw new Error('no hay grabaciones que escribir');
  const ruta = join(directorio, primera.proveedor, archivoModelo(primera.modelo));
  mkdirSync(dirname(ruta), { recursive: true });
  const lineas = [...grabaciones]
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map((g) => JSON.stringify(Object.fromEntries(CAMPOS.map((c) => [c, g[c]]))));
  writeFileSync(ruta, `${lineas.join('\n')}\n`);
  return ruta;
}

interface TablaPrecios {
  modelos: Record<string, { entrada: number | null; salida: number | null }>;
}

/** Precio de `config/nlu/precios.json` con clave `<proveedor>/<modelo>`. */
export function precioDe(proveedor: string, modelo: string, ruta = PRECIOS): Precio | undefined {
  const tabla = JSON.parse(readFileSync(ruta, 'utf8')) as TablaPrecios;
  const p = tabla.modelos[`${proveedor}/${modelo}`];
  return p === undefined ? undefined : { entrada: p.entrada, salida: p.salida };
}
