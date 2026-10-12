import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ErrorDominio } from './errores';
import { dineroLibre, puedesRetirar, type EntradaLibre, type ResultadoLibre } from './libre';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorE4 {
  id: string;
  descripcion: string;
  entrada: EntradaLibre;
  esperado: ResultadoLibre;
}

const vectores = (cargarVectores()['E4'] as VectorE4[] | undefined) ?? [];

const base: EntradaLibre = {
  hoy: '2026-10-11',
  fin_horizonte: '2026-10-15',
  liquidez: 423000,
  colchon: 20000,
  compromisos: [],
  tarjetas: [],
  cuotas_msi_no_facturadas: [],
};

describe('E4 dineroLibre', () => {
  it('carga los vectores', () => expect(vectores.length).toBe(10));

  for (const v of vectores) {
    it(`${v.id} · ${v.descripcion}`, () => {
      expect(dineroLibre(v.entrada)).toEqual(v.esperado);
    });
  }

  it('E4-10 · espacio negocio: puedes retirar $15,900', () => {
    const v = vectores.find((x) => x.id === 'E4-10');
    if (!v) throw new Error('falta el vector E4-10');
    expect(puedesRetirar(dineroLibre(v.entrada))).toBe(1590000);
    expect(puedesRetirar(dineroLibre({ ...base, liquidez: 0 }))).toBe(0);
  });

  it('un horizonte vencido o de hoy cuenta como 1 día', () => {
    const r = dineroLibre({ ...base, fin_horizonte: '2026-10-09' });
    expect(r.dias).toBe(1);
    expect(r.hoy_puedes_centavos).toBe(403000);
  });

  it('propiedad: más compromisos o deudas nunca suben el libre', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 0, max: 1e8 }),
        fc.integer({ min: -1e8, max: 1e8 }),
        (monto, deuda, saldo) => {
          const r0 = dineroLibre(base);
          const r1 = dineroLibre({
            ...base,
            compromisos: [{ concepto: 'x', fecha: '2026-10-12', monto }],
            tarjetas: [{ id: 't', modo: 'totalero', saldo_revolvente: saldo }],
            deudas_personas: [{ contraparte: 'p', monto: deuda, apartar: true }],
          });
          expect(r1.libre).toBeLessThanOrEqual(r0.libre);
          expect(r1.hoy_puedes_centavos).toBeLessThanOrEqual(r0.hoy_puedes_centavos);
          expect(r1.libre + r1.reservado + base.colchon).toBe(base.liquidez);
        },
      ),
    );
  });

  it('rechaza montos no enteros o negativos donde no caben', () => {
    expect(() => dineroLibre({ ...base, liquidez: 1.5 })).toThrow(ErrorDominio);
    expect(() => dineroLibre({ ...base, colchon: -1 })).toThrow(ErrorDominio);
    expect(() =>
      dineroLibre({ ...base, compromisos: [{ concepto: 'x', fecha: '2026-10-12', monto: -5 }] }),
    ).toThrow(ErrorDominio);
    expect(() => dineroLibre({ ...base, fin_horizonte: '2026-13-01' })).toThrow(ErrorDominio);
  });
});
