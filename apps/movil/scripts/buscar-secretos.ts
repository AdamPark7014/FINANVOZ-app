/**
 * Revisa el bundle exportado (o un APK/AAB descomprimido) en busca de secretos, como `strings` + grep
 * (`08 §7.1`, regla 8). Lee cada archivo como bytes (latin1) para cubrir binarios. Sale con 1 si encuentra algo
 * y solo imprime el archivo y el tipo de patrón, nunca el secreto.
 *
 * Uso: `pnpm --filter movil secretos <carpeta-o-archivo>...` (p. ej. `dist` tras `expo export`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buscarSecretos } from '../src/seguridad/secretos';

function archivos(ruta: string): string[] {
  if (statSync(ruta).isDirectory()) return readdirSync(ruta).flatMap((n) => archivos(join(ruta, n)));
  return [ruta];
}

const rutas = process.argv.slice(2).map((r) => resolve(r));
if (rutas.length === 0) {
  console.error('Uso: buscar-secretos <carpeta-o-archivo>...');
  process.exit(2);
}
let revisados = 0;
let hallazgos = 0;
for (const archivo of rutas.flatMap(archivos)) {
  revisados += 1;
  for (const nombre of buscarSecretos(readFileSync(archivo).toString('latin1'))) {
    hallazgos += 1;
    console.error(`${archivo}: posible secreto (${nombre})`);
  }
}
console.log(`${revisados} archivos revisados, ${hallazgos} hallazgos.`);
process.exit(hallazgos > 0 ? 1 : 0);
