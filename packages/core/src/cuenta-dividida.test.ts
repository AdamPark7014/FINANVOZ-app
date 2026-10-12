import { describe, expect, it } from 'vitest';
import { balancePareja, dividirCuenta, repartoPareja, type EventoPareja } from './cuenta-dividida';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorDividir {
  id: string;
  total: number;
  partes: number;
  esperado: { parte_usuario: number; partes_otros: number[]; por_cobrar_total: number };
}

interface VectorReparto {
  id: string;
  total: number;
  proporcion_a_bp: number;
  esperado: { parte_a: number; parte_b: number };
}

type EventoVector =
  | { id: string; tipo?: 'gasto'; total: number; pago: 'a' | 'b'; proporcion_a_bp: number; anulado?: boolean }
  | { id: string; tipo: 'pago'; de: 'a' | 'b'; monto: number; anulado?: boolean };

interface VectorBalance {
  id: string;
  gastos: EventoVector[];
  esperado: { saldo: number; debe: 'a' | 'b' | null; monto: number };
}

const e12 = cargarVectores()['E12'] as {
  dividir_cuenta: VectorDividir[];
  reparto_pareja: VectorReparto[];
  balance_pareja: VectorBalance[];
};

function aEvento(e: EventoVector): EventoPareja {
  const anulado = e.anulado ?? false;
  if (e.tipo === 'pago') return { id: e.id, tipo: 'pago', de: e.de, monto: e.monto, anulado };
  return {
    id: e.id,
    tipo: 'gasto',
    total: e.total,
    pago: e.pago,
    proporcionABp: e.proporcion_a_bp,
    anulado,
  };
}

describe('E12.1 dividirCuenta', () => {
  it('carga los vectores', () => expect(e12.dividir_cuenta.length).toBeGreaterThan(0));

  for (const v of e12.dividir_cuenta) {
    it(`${v.id} · ${v.total} entre ${v.partes}`, () => {
      expect(dividirCuenta(v.total, v.partes)).toEqual({
        parteUsuario: v.esperado.parte_usuario,
        partesOtros: v.esperado.partes_otros,
        porCobrarTotal: v.esperado.por_cobrar_total,
      });
    });
  }

  it('rechaza partes < 1', () => expect(() => dividirCuenta(100, 0)).toThrow(ErrorDominio));
});

describe('E12.2 repartoPareja', () => {
  it('carga los vectores', () => expect(e12.reparto_pareja.length).toBeGreaterThan(0));

  for (const v of e12.reparto_pareja) {
    it(`${v.id} · ${v.total} con A al ${v.proporcion_a_bp} bp`, () => {
      expect(repartoPareja(v.total, v.proporcion_a_bp)).toEqual({
        parteA: v.esperado.parte_a,
        parteB: v.esperado.parte_b,
      });
    });
  }

  it('rechaza proporciones fuera de 0–10000', () => {
    expect(() => repartoPareja(100, 10001)).toThrow(ErrorDominio);
    expect(() => repartoPareja(100, -1)).toThrow(ErrorDominio);
  });
});

describe('E12.2 balancePareja', () => {
  it('carga los vectores', () => expect(e12.balance_pareja.length).toBeGreaterThan(0));

  for (const v of e12.balance_pareja) {
    it(`${v.id} · debe ${v.esperado.debe ?? 'nadie'} ${v.esperado.monto}`, () => {
      expect(balancePareja(v.gastos.map(aEvento))).toEqual(v.esperado);
    });
  }
});
