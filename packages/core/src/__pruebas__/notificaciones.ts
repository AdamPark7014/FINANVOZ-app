import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = (nombre: string) =>
  fileURLToPath(new URL(`../../../../fixtures/notificaciones/${nombre}`, import.meta.url));

/** Carga `fixtures/notificaciones/plantillas.ejemplo.json` (sin validar: eso lo hace el motor). */
export function cargarPlantillasEjemplo(): unknown {
  return JSON.parse(readFileSync(ruta('plantillas.ejemplo.json'), 'utf8')) as unknown;
}

export interface EjemploNotificacion {
  id: string;
  paquete: string;
  titulo: string;
  texto: string;
  esperado: Record<string, unknown> & { plantilla: string | null; tipo: string };
}

/** Carga un `.jsonl` de `fixtures/notificaciones/` (una notificación por línea). */
export function cargarEjemplos(nombre: 'ejemplos.jsonl' | 'negocio.ejemplos.jsonl'): EjemploNotificacion[] {
  return readFileSync(ruta(nombre), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as EjemploNotificacion);
}
