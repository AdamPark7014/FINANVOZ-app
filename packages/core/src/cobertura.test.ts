import { describe, expect, it } from 'vitest';
import {
  cubreOcurrencia,
  elegirOcurrencia,
  type MovimientoCobertura,
  type OcurrenciaCobertura,
  type SimilitudComercio,
} from './cobertura';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorCobertura {
  id: string;
  descripcion: string;
  ocurrencia: OcurrenciaCobertura;
  movimiento: MovimientoCobertura;
  esperado: string;
}

const e3 = cargarVectores()['E3'] as Record<string, unknown>;
const vectores = (e3['cobertura'] as VectorCobertura[] | undefined) ?? [];

/**
 * Doble de prueba de E9.2 (`similitud(normalizarComercio(a), normalizarComercio(b))`): solo la regla
 * de tokens contenidos. En producción se inyecta la de E9.
 */
const similitudDoble: SimilitudComercio = (a, b) => {
  const tokens = (s: string) =>
    s
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean);
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return corto.every((t) => largo.includes(t)) ? 1 : 0;
};

describe('E3.5 cubreOcurrencia', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const v of vectores) {
    it(`${v.id} · ${v.descripcion}`, () => {
      expect(cubreOcurrencia(v.ocurrencia, v.movimiento, similitudDoble)).toBe(v.esperado);
    });
  }

  it('sin similitud inyectada, el comercio nunca empata (no se marca cubierto de más)', () => {
    const oc: OcurrenciaCobertura = {
      tipo: 'egreso',
      fecha: '2026-10-14',
      monto: 21900,
      comercio: 'NETFLIX',
    };
    const mov: MovimientoCobertura = {
      sentido: 'salida',
      fecha: '2026-10-14',
      monto: 21900,
      cuenta: 'tarj',
      comercio: 'NETFLIX',
    };
    expect(cubreOcurrencia(oc, mov)).toBe('no');
  });

  it('cuenta distinta o sentido contrario → no', () => {
    const oc: OcurrenciaCobertura = {
      tipo: 'ingreso',
      fecha: '2026-10-15',
      monto: 650000,
      cuenta: 'cta_a',
    };
    expect(
      cubreOcurrencia(oc, { sentido: 'entrada', fecha: '2026-10-15', monto: 650000, cuenta: 'cta_b' }),
    ).toBe('no');
    expect(
      cubreOcurrencia(oc, { sentido: 'salida', fecha: '2026-10-15', monto: 650000, cuenta: 'cta_a' }),
    ).toBe('no');
    expect(
      cubreOcurrencia(oc, { sentido: 'entrada', fecha: '2026-10-17', monto: 650000, cuenta: 'cta_a' }),
    ).toBe('cubrir');
    expect(
      cubreOcurrencia(oc, { sentido: 'entrada', fecha: '2026-10-18', monto: 650000, cuenta: 'cta_a' }),
    ).toBe('no');
  });

  it('elegirOcurrencia: menor diferencia relativa de monto, luego fecha más cercana', () => {
    const mov: MovimientoCobertura = {
      sentido: 'salida',
      fecha: '2026-10-15',
      monto: 50000,
      cuenta: 'c',
      categoria: 'servicios',
    };
    const base = { tipo: 'egreso' as const, categoria: 'servicios', variable: true };
    const ocs: OcurrenciaCobertura[] = [
      { ...base, fecha: '2026-10-15', monto: 55000 },
      { ...base, fecha: '2026-10-13', monto: 51000 },
      { ...base, fecha: '2026-10-16', monto: 51000 },
      { ...base, fecha: '2026-10-15', monto: 90000 },
    ];
    expect(elegirOcurrencia(ocs, mov)).toEqual({ indice: 2, decision: 'cubrir' });
    expect(elegirOcurrencia(ocs.slice(3), mov)).toBeNull();
  });
});
