import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ajustarFinDeSemana,
  aDias,
  conDia,
  desdeDias,
  diaSemana,
  diferenciaDias,
  sumarDias,
  sumarMeses,
  type ModoFinDeSemana,
} from './fecha';
import { porcentajeMostrado, redondearPorcentaje } from './porcentaje';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

const e1 = cargarVectores()['E1'] as Record<string, Record<string, unknown>[]>;
const lista = (k: string) => e1[k] ?? [];

describe('E1.2 fechas', () => {
  for (const v of lista('con_dia_acotado')) {
    it(`${String(v['id'])} · conDia`, () =>
      expect(conDia(v['anio'] as number, v['mes'] as number, v['dia'] as number)).toBe(v['esperado']));
  }
  for (const v of lista('ajuste_fin_de_semana')) {
    it(`${String(v['id'])} · ajustarFinDeSemana ${String(v['modo'])}`, () =>
      expect(ajustarFinDeSemana(v['fecha'] as string, v['modo'] as ModoFinDeSemana)).toBe(v['esperado']));
  }

  it('aritmética de días', () => {
    expect(aDias('1970-01-01')).toBe(0);
    expect(diaSemana('2026-10-12')).toBe(1);
    expect(diaSemana('2026-10-18')).toBe(7);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(diferenciaDias('2026-10-12', '2026-10-31')).toBe(19);
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15');
    expect(conDia(2026, 13, 5)).toBe('2027-01-05');
    expect(conDia(2026, 0, 31)).toBe('2025-12-31');
  });

  it('ida y vuelta entre fecha y días', () => {
    fc.assert(fc.property(fc.integer({ min: -200000, max: 200000 }), (d) => aDias(desdeDias(d)) === d));
  });

  it('rechaza fechas inválidas', () => {
    expect(() => aDias('2026-02-30')).toThrow(ErrorDominio);
    expect(() => aDias('2026-1-5')).toThrow(ErrorDominio);
  });
});

describe('E1.3 porcentajes', () => {
  for (const v of lista('redondear_porcentaje')) {
    it(`${String(v['id'])} · redondearPorcentaje`, () =>
      expect(redondearPorcentaje(v['num'] as number, v['den'] as number)).toBe(v['esperado']));
  }
  for (const v of lista('porcentaje_mostrado')) {
    it(`${String(v['id'])} · porcentajeMostrado`, () =>
      expect(porcentajeMostrado(v['exitos'] as number, v['n'] as number)).toBe(v['esperado']));
  }
  it('rechaza denominador cero', () => expect(() => redondearPorcentaje(1, 0)).toThrow(ErrorDominio));
});
