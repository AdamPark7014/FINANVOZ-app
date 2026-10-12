import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PlainDate } from '@cartera/core';
import { abrirBaseCifrada, type BaseAbierta } from '../../db/abrir';
import { almacenEnMemoria } from '../../db/llave';
import { aleatorioNode, puertoNode } from '../../db/node';
import { crearContexto, type Contexto } from '../contexto';
import { crearGeneradorSecuencial } from '../ids';
import { relojFijo } from '../reloj';

const FIXTURES = fileURLToPath(new URL('../../../../../fixtures', import.meta.url));

export interface Prueba {
  readonly ctx: Contexto;
  readonly reloj: ReturnType<typeof relojFijo>;
  readonly base: BaseAbierta;
  readonly almacen: ReturnType<typeof almacenEnMemoria>;
}

/** Base nueva en memoria abierta como en la app (llave, migraciones) con reloj fijo. */
export function abrirPrueba(hoy: PlainDate = '2026-10-11', archivo = ':memory:'): Prueba {
  const almacen = almacenEnMemoria();
  const base = abrirBaseCifrada({ puerto: puertoNode(archivo), almacen, aleatorio: aleatorioNode });
  const reloj = relojFijo(hoy);
  const ctx = crearContexto({ db: base.db, reloj, generarId: crearGeneradorSecuencial() });
  return { ctx, reloj, base, almacen };
}

/** `fixtures/escenarios/<id>.json` tal cual. */
export function escenario(id: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURES}/escenarios/${id}.json`, 'utf8'));
}

let vectores: unknown = null;

/** Un vector de `fixtures/motores/vectores.json` por `id` (el contrato; nunca se copia). */
export function vector<T = Record<string, unknown>>(id: string): T {
  vectores ??= JSON.parse(readFileSync(`${FIXTURES}/motores/vectores.json`, 'utf8'));
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

/** Tarjeta de `E5.tarjetas_fixture` por id (configuración de ciclo y saldo de los vectores E5/E6). */
export function tarjetaFixture<T = Record<string, unknown>>(id: string): T {
  vector('E5-01'); // carga el archivo
  const e5 = (vectores as { E5: { tarjetas_fixture: { id: string }[] } }).E5;
  const t = e5.tarjetas_fixture.find((x) => x.id === id);
  if (!t) throw new Error(`no existe la tarjeta ${id}`);
  return t as T;
}
