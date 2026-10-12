/** `pnpm --filter @cartera/nlu generar:proveedor`: escribe los archivos del proxy generados desde Zod. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ARCHIVOS_GENERADOS, raiz } from './generados';

for (const archivo of ARCHIVOS_GENERADOS) {
  const destino = raiz(archivo.ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, await archivo.contenido());
  console.log(`escrito ${archivo.ruta}`);
}
