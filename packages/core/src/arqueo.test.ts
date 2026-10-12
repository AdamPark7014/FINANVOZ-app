import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { arqueo, corteDeCaja, type GastoHistorial } from './arqueo';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorArqueo {
  id: string;
  saldo_contable: number;
  efectivo_real: number;
  historial: GastoHistorial[];
  marcados: number[];
  esperado: unknown;
}

interface VectorCorte {
  id: string;
  descripcion: string;
  saldo_contable: number;
  efectivo_real: number;
  marcados: number[];
  esperado: unknown;
}

const e7 = cargarVectores()['E7'] as Record<string, unknown>;
const vArqueo = (e7['arqueo'] as VectorArqueo[] | undefined) ?? [];
const vCorte = (e7['corte_de_caja'] as VectorCorte[] | undefined) ?? [];

describe('E7 arqueo', () => {
  it('carga los vectores', () => expect(vArqueo.length).toBeGreaterThan(0));

  for (const v of vArqueo) {
    it(`${v.id} · saldo ${v.saldo_contable}, real ${v.efectivo_real}`, () => {
      expect(
        arqueo({
          saldo_contable: v.saldo_contable,
          efectivo_real: v.efectivo_real,
          historial: v.historial,
          marcados: v.marcados,
        }),
      ).toEqual(v.esperado);
    });
  }

  it('propiedad: la propuesta suma exactamente el hueco', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 0, max: 1e9 }),
        fc.array(
          fc.record({
            categoria: fc.constantFrom('a', 'b', 'c', 'd', 'e'),
            monto: fc.integer({ min: 0, max: 1e7 }),
          }),
        ),
        (saldo, real, historial) => {
          const r = arqueo({ saldo_contable: saldo, efectivo_real: real, historial });
          const suma = r.propuesta.reduce((s, p) => s + p.monto, 0);
          expect(suma).toBe(r.hueco > 0 ? r.hueco : 0);
          expect(r.propuesta.length).toBeLessThanOrEqual(4);
        },
      ),
    );
  });

  it('rechaza montos inválidos', () => {
    expect(() => arqueo({ saldo_contable: 1.5, efectivo_real: 0, historial: [] })).toThrow(ErrorDominio);
    expect(() => arqueo({ saldo_contable: 100, efectivo_real: -1, historial: [] })).toThrow(ErrorDominio);
    expect(() => arqueo({ saldo_contable: 100, efectivo_real: 0, historial: [], marcados: [-5] })).toThrow(
      ErrorDominio,
    );
  });
});

describe('E7.2 corteDeCaja', () => {
  it('carga los vectores', () => expect(vCorte.length).toBeGreaterThan(0));

  for (const v of vCorte) {
    it(`${v.id} · ${v.descripcion}`, () => {
      expect(
        corteDeCaja({
          saldo_contable: v.saldo_contable,
          efectivo_real: v.efectivo_real,
          marcados: v.marcados,
        }),
      ).toEqual(v.esperado);
    });
  }
});
