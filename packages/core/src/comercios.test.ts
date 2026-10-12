import { describe, expect, it } from 'vitest';
import { jaro, jaroWinkler, normalizarComercio, similitud } from './comercios';
import { cargarVectores } from './__pruebas__/vectores';

const TOLERANCIA = 1e-6;
const e9 = cargarVectores()['E9'] as Record<string, unknown>;
const grupo = <T>(k: string) => (e9[k] as T[] | undefined) ?? [];

interface VectorNormalizar {
  id: string;
  entrada: string | null;
  esperado: string;
}
interface VectorJaro {
  id: string;
  a: string;
  b: string;
  jaro: number;
  jaro_winkler: number;
}
interface VectorSimilitud {
  id: string;
  a: string;
  b: string;
  esperado: number;
}

describe('E9.1 normalizarComercio', () => {
  it('carga los vectores', () => expect(grupo('normalizar_comercio').length).toBeGreaterThan(0));
  for (const v of grupo<VectorNormalizar>('normalizar_comercio')) {
    it(`${v.id} · normalizarComercio`, () => expect(normalizarComercio(v.entrada)).toBe(v.esperado));
  }
  it('undefined y solo espacios dan cadena vacía', () => {
    expect(normalizarComercio(undefined)).toBe('');
    expect(normalizarComercio('   ')).toBe('');
  });
});

describe('E9.2 Jaro y Jaro–Winkler', () => {
  it('carga los vectores', () => expect(grupo('jaro_winkler').length).toBeGreaterThan(0));
  for (const v of grupo<VectorJaro>('jaro_winkler')) {
    it(`${v.id} · ${v.a} / ${v.b}`, () => {
      expect(Math.abs(jaro(v.a, v.b) - v.jaro)).toBeLessThanOrEqual(TOLERANCIA);
      expect(Math.abs(jaroWinkler(v.a, v.b) - v.jaro_winkler)).toBeLessThanOrEqual(TOLERANCIA);
    });
  }
  it('cadenas vacías', () => {
    expect(jaro('', '')).toBe(0);
    expect(jaro('', 'A')).toBe(0);
    expect(jaroWinkler('', '')).toBe(0);
  });
});

describe('E9.2 similitud', () => {
  it('carga los vectores', () => expect(grupo('similitud').length).toBeGreaterThan(0));
  for (const v of grupo<VectorSimilitud>('similitud')) {
    it(`${v.id} · ${JSON.stringify(v.a)} / ${JSON.stringify(v.b)}`, () =>
      expect(Math.abs(similitud(v.a, v.b) - v.esperado)).toBeLessThanOrEqual(TOLERANCIA));
  }
});
