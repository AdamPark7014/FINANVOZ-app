import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';
import { claveCuotaMsi, compromisoPorMes, planMsi, planMsiExistente } from './msi';
import { cortesAProcesar, type TarjetaCredito } from './tarjetas';
import { cargarVectores } from './__pruebas__/vectores';

interface TarjetaVector {
  id: string;
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
}

interface CuotaVector {
  n: number;
  monto: number;
  corte: string;
  limite: string;
}

interface VectorPlan {
  id: string;
  monto: number;
  meses: number;
  fecha_compra: string;
  tarjeta: string;
  meses_diferimiento: number;
  esperado: { cuotas: CuotaVector[]; compromiso_por_mes: Record<string, number> };
}

interface VectorPlanExistente {
  id: string;
  mensualidad: number;
  restantes: number;
  hoy: string;
  tarjeta: string;
  esperado: { saldo_msi: number; cuotas: CuotaVector[] };
}

interface VectorCortes {
  id: string;
  tarjeta: string;
  alta: string;
  hoy: string;
  procesados: string[];
  esperado: string[];
}

const todos = cargarVectores();
const fixture = (todos['E5'] as { tarjetas_fixture: TarjetaVector[] }).tarjetas_fixture;
const e6 = todos['E6'] as {
  planes: VectorPlan[];
  planes_existentes: VectorPlanExistente[];
  cortes_a_procesar: VectorCortes[];
};

/** Los vectores de E6 nombran la tarjeta por `id`; su ciclo sale de `E5.tarjetas_fixture`. */
function tarjeta(id: string): TarjetaCredito {
  const t = fixture.find((f) => f.id === id);
  if (!t) throw new Error(`tarjeta ${id} no está en E5.tarjetas_fixture`);
  return {
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
  };
}

describe('E6.1 planMsi', () => {
  it('carga los vectores', () => expect(e6.planes.length).toBeGreaterThan(0));

  for (const v of e6.planes) {
    it(`${v.id} · ${v.monto} a ${v.meses} meses (diferimiento ${v.meses_diferimiento})`, () => {
      const cuotas = planMsi(v.monto, v.meses, v.fecha_compra, tarjeta(v.tarjeta), v.meses_diferimiento);
      expect(cuotas).toEqual(v.esperado.cuotas);
      expect(compromisoPorMes(cuotas)).toEqual(v.esperado.compromiso_por_mes);
      expect(cuotas.reduce((s, c) => s + c.monto, 0)).toBe(v.monto);
    });
  }

  it('rechaza meses o monto inválidos', () => {
    const t = tarjeta('tarj_banamex_8812');
    expect(() => planMsi(100000, 0, '2026-10-11', t)).toThrow(ErrorDominio);
    expect(() => planMsi(-1, 3, '2026-10-11', t)).toThrow(ErrorDominio);
    expect(() => planMsi(100000, 3, '2026-10-11', t, -1)).toThrow(ErrorDominio);
  });

  it('claveCuotaMsi', () => expect(claveCuotaMsi('p1', 2)).toBe('msi:p1:2'));
});

describe('E6.1 planMsiExistente', () => {
  it('carga los vectores', () => expect(e6.planes_existentes.length).toBeGreaterThan(0));

  for (const v of e6.planes_existentes) {
    it(`${v.id} · faltan ${v.restantes} de ${v.mensualidad}`, () => {
      const r = planMsiExistente(v.mensualidad, v.restantes, v.hoy, tarjeta(v.tarjeta));
      expect(r.saldoMsi).toBe(v.esperado.saldo_msi);
      expect(r.cuotas).toEqual(v.esperado.cuotas);
    });
  }
});

describe('E5.3 cortesAProcesar', () => {
  it('carga los vectores', () => expect(e6.cortes_a_procesar.length).toBeGreaterThan(0));

  for (const v of e6.cortes_a_procesar) {
    it(`${v.id} · alta ${v.alta}, hoy ${v.hoy}`, () => {
      expect(cortesAProcesar(tarjeta(v.tarjeta), v.alta, v.hoy, v.procesados)).toEqual(v.esperado);
    });
  }
});
