import { describe, expect, it } from 'vitest';
import {
  decidirDuplicado,
  elegirMovimiento,
  emparejarTransferencias,
  type CapturaDedup,
  type CapturaTransferencia,
  type MovimientoDedup,
  type ParTransferencia,
} from './deduplicacion';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

const TOLERANCIA = 1e-6;
const e9 = cargarVectores()['E9'] as Record<string, unknown>;

interface VectorDecision {
  id: string;
  descripcion: string;
  captura: { cuenta: string; monto: number; fecha: string; comercio: string | null; sentido?: string };
  movimiento: {
    cuenta: string;
    cuenta_raiz?: string;
    monto: number;
    fecha: string;
    comercio: string | null;
    tipo?: string;
  };
  esperado: { decision: string; delta_dias: number | null; similitud: number | null };
}

interface CapturaVector {
  id: string;
  cuenta: string;
  espacio?: 'personal' | 'negocio';
  monto: number;
  fecha: string;
  tipo: string;
  ya_registrada?: boolean;
}
interface GrupoEmparejar {
  id?: string;
  descripcion?: string;
  salidas: CapturaVector[];
  entradas: CapturaVector[];
  esperado: {
    salida: string;
    entrada: string;
    movimiento: string;
    pago_tarjeta?: boolean;
    reemplazar: string[];
  }[];
}

const aCaptura = (v: VectorDecision['captura']): CapturaDedup => ({
  cuenta: v.cuenta,
  monto: v.monto,
  fecha: v.fecha,
  comercio: v.comercio,
  sentido: v.sentido === 'entrada' ? 'entrada' : 'salida',
});
const aMovimiento = (v: VectorDecision['movimiento']): MovimientoDedup => ({
  cuenta: v.cuenta,
  ...(v.cuenta_raiz === undefined ? {} : { cuentaRaiz: v.cuenta_raiz }),
  monto: v.monto,
  fecha: v.fecha,
  comercio: v.comercio,
  ...(v.tipo === undefined ? {} : { tipo: v.tipo }),
});
const aTransferencia = (v: CapturaVector): CapturaTransferencia => ({
  id: v.id,
  cuenta: v.cuenta,
  espacio: v.espacio ?? 'personal',
  monto: v.monto,
  fecha: v.fecha,
  tipo: v.tipo as CapturaTransferencia['tipo'],
  yaRegistrada: v.ya_registrada ?? false,
});
const aVector = (p: ParTransferencia) => ({
  salida: p.salida,
  entrada: p.entrada,
  movimiento: p.movimiento,
  ...(p.pagoTarjeta === undefined ? {} : { pago_tarjeta: p.pagoTarjeta }),
  reemplazar: p.reemplazar,
});

describe('E9.3 decidirDuplicado', () => {
  const vectores = (e9['decision'] as VectorDecision[] | undefined) ?? [];
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));
  for (const v of vectores) {
    it(`${v.id} · ${v.descripcion} → ${v.esperado.decision}`, () => {
      const r = decidirDuplicado(aCaptura(v.captura), aMovimiento(v.movimiento));
      expect(r.decision).toBe(v.esperado.decision);
      expect(r.deltaDias).toBe(v.esperado.delta_dias);
      if (v.esperado.similitud === null) expect(r.similitud).toBeNull();
      else
        expect(Math.abs((r.similitud ?? Number.NaN) - v.esperado.similitud)).toBeLessThanOrEqual(TOLERANCIA);
    });
  }

  it('rechaza montos que no son centavos enteros', () => {
    const mov: MovimientoDedup = { cuenta: 'c', monto: 100, fecha: '2026-10-11', comercio: null };
    const cap: CapturaDedup = { ...mov, monto: 1.5, sentido: 'salida' };
    expect(() => decidirDuplicado(cap, mov)).toThrow(ErrorDominio);
  });
});

describe('E9.3 elegirMovimiento (uno a uno, con varias candidatas)', () => {
  const captura: CapturaDedup = {
    cuenta: 'tarj',
    monto: 25000,
    fecha: '2026-10-12',
    comercio: 'OXXO PUEBLA',
    sentido: 'salida',
  };
  const mov = (fecha: string, comercio: string | null): MovimientoDedup => ({
    cuenta: 'tarj',
    monto: 25000,
    fecha,
    comercio,
  });

  it('sin candidatas que no sean nuevo → null', () =>
    expect(elegirMovimiento(captura, [{ ...mov('2026-10-12', null), cuenta: 'otra' }])).toBeNull());

  it('gana el menor Δ', () => {
    const r = elegirMovimiento(captura, [mov('2026-10-10', null), mov('2026-10-11', null)]);
    expect(r?.indice).toBe(1);
    expect(r?.resultado.decision).toBe('fusionar');
  });

  it('a igual Δ gana la mayor similitud', () => {
    const r = elegirMovimiento(captura, [mov('2026-10-11', 'OXXO PUEBLO'), mov('2026-10-11', 'OXXO')]);
    expect(r?.indice).toBe(1);
  });

  it('a igual Δ y similitud gana la registrada primero', () => {
    const r = elegirMovimiento(captura, [mov('2026-10-11', null), mov('2026-10-11', null)]);
    expect(r?.indice).toBe(0);
  });
});

describe('E9.4 emparejarTransferencias', () => {
  const grupos = [
    'emparejar_transferencias',
    'emparejar_entrada_primero',
    'emparejar_entre_espacios',
    'emparejar_entre_espacios_salida_primero',
  ];
  for (const nombre of grupos) {
    const g = e9[nombre] as GrupoEmparejar | undefined;
    it(`${g?.id ?? 'E9'} · ${nombre}`, () => {
      expect(g).toBeDefined();
      if (!g) return;
      const pares = emparejarTransferencias(g.salidas.map(aTransferencia), g.entradas.map(aTransferencia));
      expect(pares.map(aVector)).toEqual(g.esperado);
    });
  }

  it('no empareja la misma cuenta ni Δ > 1', () => {
    const s = aTransferencia({
      id: 's',
      cuenta: 'a',
      monto: 100,
      fecha: '2026-10-11',
      tipo: 'transferencia_enviada',
    });
    const mismaCuenta: CapturaTransferencia = { ...s, id: 'e', tipo: 'transferencia_recibida' };
    const lejos: CapturaTransferencia = { ...mismaCuenta, id: 'e2', cuenta: 'b', fecha: '2026-10-13' };
    expect(emparejarTransferencias([s], [mismaCuenta, lejos])).toEqual([]);
  });
});
