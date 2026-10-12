import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Carga `fixtures/motores/vectores.json` (el contrato; nunca se copia a las pruebas). */
export function cargarVectores(): Record<string, unknown> {
  const ruta = fileURLToPath(new URL('../../../../fixtures/motores/vectores.json', import.meta.url));
  return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
}
