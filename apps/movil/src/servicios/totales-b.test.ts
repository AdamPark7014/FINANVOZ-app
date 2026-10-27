import type { Centavos } from '@cartera/core';
import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarCuentas, totalesCuentas, type CuentaDebes, type CuentaTienes } from './cuentas';
import { registrarMovimiento } from './formulario';
import { totalesDelMes } from './movimientos';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** Las frases de arriba de Movimientos (B4) y Cuentas (B5) salen de aquí, no de la pantalla. */
describe('totales de la dirección B', () => {
  it('totalesDelMes: sin movimientos lo dice; suma lo que salió y entró del día 1 a hoy, sin el mes anterior', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const efectivo = e.cuentas['efectivo'] as string;
    const antes = totalesDelMes(p.ctx);
    expect(antes.mes).toBe('octubre');

    registrarMovimiento(p.ctx, {
      tipo: 'ingreso',
      categoria: 'otros_ingresos',
      destinoId: efectivo,
      monto: 100_000,
      fecha: '2026-10-05',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 30_000,
      fecha: '2026-10-08',
    });
    // El 30 de septiembre es del mes anterior: no cuenta en «En octubre…».
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 20_000,
      fecha: '2026-09-30',
    });
    expect(totalesDelMes(p.ctx)).toEqual({
      mes: 'octubre',
      salieron: antes.salieron + 30_000,
      entraron: antes.entraron + 100_000,
      hayMovimientos: true,
    });

    p.reloj.fijar('2026-11-02');
    expect(totalesDelMes(p.ctx)).toEqual({
      mes: 'noviembre',
      salieron: 0,
      entraron: 0,
      hayMovimientos: false,
    });
  });

  it('totalesCuentas: suma Tienes; en Debes cuentan los meses sin intereses y un saldo a favor no resta', () => {
    const c = (saldo: number) => saldo as Centavos;
    const tienes = [{ saldo: c(500_000) }, { saldo: c(22_400) }] as unknown as CuentaTienes[];
    const debes = [
      { tipo: 'tarjeta', saldo: c(120_000), meses: c(50_000) },
      { tipo: 'tarjeta', saldo: c(-30_000), meses: c(0) },
      { tipo: 'persona', saldo: c(15_000), meses: c(0) },
    ] as unknown as CuentaDebes[];
    expect(totalesCuentas({ tienes, debes })).toEqual({ tienes: 522_400, debes: 185_000 });
    expect(totalesCuentas({ tienes: [], debes: [] })).toEqual({ tienes: 0, debes: 0 });
  });

  it('totalesCuentas sobre la vista real de Cuentas (e4-01)', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    const v = listarCuentas(p.ctx);
    const t = totalesCuentas(v);
    expect(t.tienes).toBe(v.tienes.reduce((s, x) => s + x.saldo, 0));
    expect(t.debes).toBeGreaterThanOrEqual(0);
  });
});
