import { describe, expect, it } from 'vitest';
import { expandirProgramados, horizonte, type Programado } from './horizonte';
import type { Regla } from './recurrencia';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorHorizonte {
  id: string;
  descripcion: string;
  hoy: string;
  regla: Regla | null;
  recibidas: string[];
  esperado: { fin: string; fin_efectivo: string; dias: number; estado: string };
}

interface VectorExpandir {
  id: string;
  descripcion: string;
  programados: Programado[];
  desde: string;
  hasta: string;
  esperado: { concepto: string; fecha: string; monto: number }[];
}

const e3 = cargarVectores()['E3'] as Record<string, unknown>;
const vHorizonte = (e3['horizonte'] as VectorHorizonte[] | undefined) ?? [];
const vExpandir = (e3['expandir_programados'] as VectorExpandir[] | undefined) ?? [];

describe('E3.3 horizonte', () => {
  it('carga los vectores', () => expect(vHorizonte.length).toBeGreaterThan(0));

  for (const v of vHorizonte) {
    it(`${v.id} · ${v.descripcion}`, () => {
      expect(horizonte(v.hoy, v.regla, v.recibidas)).toEqual(v.esperado);
    });
  }
});

describe('E3.4 expandirProgramados', () => {
  it('carga los vectores', () => expect(vExpandir.length).toBeGreaterThan(0));

  for (const v of vExpandir) {
    it(`${v.id} · ${v.descripcion}`, () => {
      expect(expandirProgramados(v.programados, v.desde, v.hasta)).toEqual(v.esperado);
    });
  }
});
