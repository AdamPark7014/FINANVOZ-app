import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';
import { proximasFechas, type Regla } from './recurrencia';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorProximas {
  id: string;
  regla: Regla;
  desde: string;
  n: number;
  esperado: string[];
}

const e3 = cargarVectores()['E3'] as Record<string, unknown>;
const vectores = (e3['proximas_fechas'] as VectorProximas[] | undefined) ?? [];

describe('E3.2 proximasFechas', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const v of vectores) {
    it(`${v.id} · ${v.regla.tipo} desde ${v.desde}`, () => {
      expect(proximasFechas(v.regla, v.desde, v.n)).toEqual(v.esperado);
    });
  }

  it('regla única: solo su fecha si es ≥ desde', () => {
    expect(proximasFechas({ tipo: 'unica', fecha: '2026-11-03' }, '2026-10-11', 3)).toEqual(['2026-11-03']);
    expect(proximasFechas({ tipo: 'unica', fecha: '2026-10-03' }, '2026-10-11', 3)).toEqual([]);
  });

  it('rechaza reglas inválidas', () => {
    expect(() => proximasFechas({ tipo: 'mensual', dia: 0 }, '2026-10-11', 1)).toThrow(ErrorDominio);
    expect(() => proximasFechas({ tipo: 'anual', mes: 13, dia: 1 }, '2026-10-11', 1)).toThrow(ErrorDominio);
    expect(() => proximasFechas({ tipo: 'quincenal_dias', dias: [10, 32] }, '2026-10-11', 1)).toThrow(
      ErrorDominio,
    );
    expect(() => proximasFechas({ tipo: 'mensual', dia: 1 }, '2026-10-11', -1)).toThrow(ErrorDominio);
  });
});
