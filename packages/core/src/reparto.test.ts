import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { distribuirMayorResiduo } from './reparto';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorReparto {
  id: string;
  total: number;
  pesos: number[];
  esperado: number[];
}

const vectores =
  (cargarVectores()['E1'] as Record<string, VectorReparto[]>)['distribuir_mayor_residuo'] ?? [];

describe('E1.1 distribuirMayorResiduo', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const v of vectores) {
    it(`${v.id} · total ${v.total} en pesos [${v.pesos.join(', ')}]`, () => {
      expect(distribuirMayorResiduo(v.total, v.pesos)).toEqual(v.esperado);
    });
  }

  it('propiedades: suma exacta, peso 0 recibe 0 y error menor a un centavo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e12, max: 1e12 }),
        fc
          .array(fc.integer({ min: 0, max: 1e9 }), { minLength: 1, maxLength: 30 })
          .filter((p) => p.some((x) => x > 0)),
        (total, pesos) => {
          const salida = distribuirMayorResiduo(total, pesos);
          expect(salida.reduce((a, b) => a + b, 0)).toBe(total);
          const w = pesos.reduce((a, b) => a + b, 0);
          pesos.forEach((p, i) => {
            if (p === 0) expect(salida[i]).toBe(0);
            expect(Math.abs((salida[i] ?? 0) - (total * p) / w)).toBeLessThan(1 + 1e-6);
          });
        },
      ),
    );
  });

  it('rechaza pesos vacíos, negativos o que suman cero', () => {
    expect(() => distribuirMayorResiduo(100, [])).toThrow(ErrorDominio);
    expect(() => distribuirMayorResiduo(100, [1, -1])).toThrow(ErrorDominio);
    expect(() => distribuirMayorResiduo(100, [0, 0])).toThrow(ErrorDominio);
    expect(() => distribuirMayorResiduo(1.5, [1])).toThrow(ErrorDominio);
  });
});
