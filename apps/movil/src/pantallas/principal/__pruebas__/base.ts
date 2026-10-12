/**
 * Contexto real para las pruebas de pantallas (jest-expo): base en memoria con better-sqlite3, migraciones y
 * reloj fijo, igual que `servicios/__pruebas__/base.ts` pero sin `import.meta` (jest corre en CommonJS).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlainDate } from '@cartera/core';
import { abrirBaseCifrada } from '../../../db/abrir';
import { almacenEnMemoria } from '../../../db/llave';
import { aleatorioNode, puertoNode } from '../../../db/node';
import { cargarEscenario, crearContexto, crearGeneradorSecuencial, relojFijo } from '../../../servicios';

const FIXTURES = join(__dirname, '../../../../../../fixtures');

export function abrirPruebaPantalla(hoy: PlainDate = '2026-10-11') {
  const base = abrirBaseCifrada({
    puerto: puertoNode(':memory:'),
    almacen: almacenEnMemoria(),
    aleatorio: aleatorioNode,
  });
  const reloj = relojFijo(hoy);
  const ctx = crearContexto({ db: base.db, reloj, generarId: crearGeneradorSecuencial() });
  return { ctx, reloj, cerrar: () => base.cerrar() };
}

export function escenario(id: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, 'escenarios', `${id}.json`), 'utf8'));
}

/** Un caso de `fixtures/nlu/golden.jsonl` por `id` (texto y `esperado`). */
export function golden(id: string): { texto: string; esperado: Record<string, unknown> } {
  const caso = readFileSync(join(FIXTURES, 'nlu', 'golden.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as { id: string; texto: string; esperado: Record<string, unknown> })
    .find((c) => c.id === id);
  if (!caso) throw new Error(`no existe el caso ${id}`);
  return caso;
}

let vectores: unknown = null;

/** Un vector de `fixtures/motores/vectores.json` por `id` (el contrato; nunca se copia). */
export function vector<T = Record<string, unknown>>(id: string): T {
  vectores ??= JSON.parse(readFileSync(join(FIXTURES, 'motores', 'vectores.json'), 'utf8'));
  const buscar = (o: unknown): unknown => {
    if (Array.isArray(o)) {
      for (const x of o) {
        const r = buscar(x);
        if (r) return r;
      }
    } else if (o && typeof o === 'object') {
      if ((o as { id?: unknown }).id === id) return o;
      for (const x of Object.values(o)) {
        const r = buscar(x);
        if (r) return r;
      }
    }
    return null;
  };
  const v = buscar(vectores);
  if (!v) throw new Error(`no existe el vector ${id}`);
  return v as T;
}

/** Base con la semilla cargada y el reloj en su `hoy`. */
export function conEscenario(id: string) {
  const p = abrirPruebaPantalla();
  const e = cargarEscenario(p.ctx, escenario(id));
  p.reloj.fijar(e.hoy);
  return { ...p, e };
}
