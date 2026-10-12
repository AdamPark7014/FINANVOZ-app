/**
 * Embebe las migraciones SQL de `packages/datos/migraciones` (formato Drizzle: `meta/_journal.json` +
 * `NNNN_nombre.sql`) en `src/db/migraciones.generado.ts`, porque en el teléfono no hay sistema de archivos
 * con el repositorio. Uso: `pnpm --filter movil migraciones`. La prueba `src/db/migraciones.test.ts` falla
 * si el módulo generado no coincide con los archivos SQL o el journal.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

export const CARPETA_MIGRACIONES = fileURLToPath(
  new URL('../../../packages/datos/migraciones', import.meta.url),
);
export const MODULO_GENERADO = fileURLToPath(new URL('../src/db/migraciones.generado.ts', import.meta.url));

interface EntradaJournal {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/** Contenido del módulo generado, ya formateado con la configuración de Prettier del repositorio. */
export async function generarModuloMigraciones(carpeta = CARPETA_MIGRACIONES): Promise<string> {
  const journal = JSON.parse(readFileSync(`${carpeta}/meta/_journal.json`, 'utf8')) as {
    entries: EntradaJournal[];
  };
  const migraciones = journal.entries.map((e) => {
    const sql = readFileSync(`${carpeta}/${e.tag}.sql`, 'utf8');
    return {
      idx: e.idx,
      etiqueta: e.tag,
      cuando: e.when,
      puntosDeCorte: e.breakpoints,
      // Mismo hash que guarda el migrador de Drizzle para Node (sha256 del archivo completo).
      hash: createHash('sha256').update(sql).digest('hex'),
      sql,
    };
  });
  const fuente = [
    '// Generado por scripts/generar-migraciones.ts a partir de packages/datos/migraciones. No editar a mano:',
    '// corre `pnpm --filter movil migraciones` después de agregar una migración.',
    "import type { MigracionEmbebida } from './migrar';",
    '',
    `export const MIGRACIONES: readonly MigracionEmbebida[] = ${JSON.stringify(migraciones, null, 2)};`,
    '',
  ].join('\n');
  const config = await resolveConfig(MODULO_GENERADO);
  return format(fuente, { ...config, filepath: MODULO_GENERADO });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void generarModuloMigraciones().then((contenido) => {
    writeFileSync(MODULO_GENERADO, contenido);
    console.log('migraciones embebidas actualizadas');
  });
}
