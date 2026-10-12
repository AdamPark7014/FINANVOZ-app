import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { interpretarNotificacion } from '@cartera/core';
import { catalogoEmbebido, combinarPlantillas } from './catalogo';
import reales from './plantillas/reales.json';

interface Ejemplo {
  readonly id: string;
  readonly paquete: string;
  readonly titulo: string;
  readonly texto: string;
  readonly esperado: { readonly plantilla: string | null; readonly tipo: string } & Record<string, unknown>;
}

function leer(ruta: URL): Ejemplo[] {
  return readFileSync(fileURLToPath(ruta), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Ejemplo);
}

const ejemplosReales = leer(new URL('./plantillas/reales.ejemplos.jsonl', import.meta.url));
const ejemplosSinteticos = [
  ...leer(new URL('../../../../fixtures/notificaciones/ejemplos.jsonl', import.meta.url)),
  ...leer(new URL('../../../../fixtures/notificaciones/negocio.ejemplos.jsonl', import.meta.url)),
];

function comprobar(catalogo: ReturnType<typeof catalogoEmbebido>, e: Ejemplo) {
  const r = interpretarNotificacion({ paquete: e.paquete, titulo: e.titulo, texto: e.texto }, catalogo);
  const { plantilla, ...campos } = e.esperado;
  expect({ id: e.id, ...r }).toMatchObject({ id: e.id, plantilla, ...campos });
}

/**
 * Plantillas embebidas (CA-M5-07): agregar un banco real es solo datos (`plantillas/reales.json` y un ejemplo
 * anonimizado por plantilla en `plantillas/reales.ejemplos.jsonl`); esta prueba no cambia.
 */
describe('plantillas embebidas', () => {
  it('las reales compilan solas y cada plantilla tiene al menos un ejemplo que la elige', () => {
    const catalogo = combinarPlantillas([reales]);
    const cubiertas = new Set(ejemplosReales.map((e) => e.esperado.plantilla));
    for (const p of catalogo.plantillas)
      expect({ plantilla: p.id, conEjemplo: cubiertas.has(p.id) }).toEqual({
        plantilla: p.id,
        conEjemplo: true,
      });
    for (const e of ejemplosReales) comprobar(catalogo, e);
  });

  it('las sintéticas de fixtures pasan con el catálogo de desarrollo (07 §3)', () => {
    const catalogo = catalogoEmbebido(true);
    for (const e of ejemplosSinteticos) comprobar(catalogo, e);
  });

  it('las reales van antes que las sintéticas y no repiten paquetes', () => {
    const catalogo = catalogoEmbebido(true);
    const paquetes = catalogo.bancos.flatMap((b) => b.paquetesAndroid);
    expect(new Set(paquetes).size).toBe(paquetes.length);
    expect(catalogo.version).toBe(1);
  });
});
