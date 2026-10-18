import { describe, expect, it } from 'vitest';
import { construirCuentaDividida, construirReembolso, type PlainDate } from '@cartera/core';
import { idCategoria } from '@cartera/datos';
import { confirmarArqueo } from './arqueo';
import { anularMovimiento, registrarMovimiento } from './formulario';
import { historialSimulacion, marcarExtraordinaria, transaccionesHistorial } from './historial';
import { listarOcurrencias, yaLaPague } from './ocurrencias';
import { crearPersona } from './personas';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';
import { procesarApertura } from './apertura';

/** e4-01 con reloj en el `hoy` del escenario. */
function e401() {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  p.reloj.fijar(e.hoy);
  return {
    ...p,
    e,
    efectivo: e.cuentas['efectivo'] as string,
    bbva: e.cuentas['bbva'] as string,
    nu: e.cuentas['nu'] as string,
  };
}

describe('transaccionesHistorial (E8.2 · pendiente 113)', () => {
  it('agrega monto_gasto en SQL, excluye anuladas y marca cubre_ocurrencia', () => {
    const p = e401();
    procesarApertura(p.ctx);
    const gasto = (fecha: PlainDate, monto: number, origenId = p.efectivo) =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId, monto, fecha });

    const g12 = gasto('2026-10-12', 10_000);
    p.reloj.fijar('2026-10-13');
    const tanda = listarOcurrencias(p.ctx).find((o) => o.concepto === 'tanda');
    if (!tanda) throw new Error('falta la tanda');
    yaLaPague(p.ctx, tanda);
    const extra = gasto('2026-10-16', 900_000, p.nu);
    marcarExtraordinaria(p.ctx, extra.transaccionId, true);
    const anulado = gasto('2026-10-17', 7_000);
    anularMovimiento(p.ctx, anulado.transaccionId);
    const amigo = crearPersona(p.ctx, { nombre: 'Juan' });
    const dividida = construirCuentaDividida({
      categoria: idCategoria('comida_fuera'),
      personas: [amigo],
      pago: p.bbva,
      total: 120_000,
    });
    p.ctx.libro.registrar({
      tipo: dividida.tipo,
      fecha: '2026-10-19',
      origen: 'manual',
      claveIdempotencia: 'prueba:dividida-historial',
      asientos: dividida.asientos,
    });
    const reembolso = construirReembolso({ destino: p.nu, contra: idCategoria('antojos'), monto: 3_000 });
    p.ctx.libro.registrar({
      tipo: reembolso.tipo,
      fecha: '2026-10-20',
      origen: 'manual',
      claveIdempotencia: 'prueba:reembolso-historial',
      asientos: reembolso.asientos,
    });
    p.reloj.fijar('2026-10-22');
    confirmarArqueo(p.ctx, { efectivoReal: 30_000 });

    const txs = transaccionesHistorial(p.ctx, '2026-10-11', '2026-10-22');
    const porFecha = (f: PlainDate) => txs.filter((t) => t.fecha === f);

    expect(porFecha('2026-10-12')).toEqual([{ fecha: '2026-10-12', tipo: 'gasto', monto_gasto: 10_000 }]);
    expect(porFecha('2026-10-17')).toEqual([]);
    expect(porFecha('2026-10-16')).toEqual([
      { fecha: '2026-10-16', tipo: 'gasto', monto_gasto: 900_000, extraordinaria: true },
    ]);
    expect(porFecha('2026-10-19')).toEqual([
      { fecha: '2026-10-19', tipo: 'cuenta_dividida', monto_gasto: 60_000 },
    ]);
    expect(porFecha('2026-10-20')).toEqual([
      { fecha: '2026-10-20', tipo: 'reembolso', monto_gasto: -3_000 },
    ]);

    const cubre = txs.find((t) => t.cubre_ocurrencia);
    expect(cubre?.fecha).toBe('2026-10-13');

    const arqueo = txs.find((t) => t.tipo === 'ajuste_arqueo');
    expect(arqueo?.monto_gasto).toBeGreaterThan(0);
    expect(arqueo?.arqueo_anterior).toBeNull();

    expect(g12.transaccionId).toBeDefined();
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('extraordinaria no entra al consumo diario de historialSimulacion', () => {
    const p = e401();
    procesarApertura(p.ctx);
    const extra = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto: 500_000,
      fecha: '2026-10-14',
    });
    marcarExtraordinaria(p.ctx, extra.transaccionId, true);
    p.reloj.fijar('2026-10-26');
    const h = historialSimulacion(p.ctx);
    expect(h.historial.find((d) => d.fecha === '2026-10-14')?.consumo).toBe(0);
  });

  it('historialSimulacion sigue igual que antes (CA-M6-04 parcial)', () => {
    const p = e401();
    procesarApertura(p.ctx);
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto: 10_000,
      fecha: '2026-10-12',
    });
    p.reloj.fijar('2026-10-26');
    const h = historialSimulacion(p.ctx);
    expect(h.inicioUso).toBe('2026-10-11');
    expect(h.historial.find((d) => d.fecha === '2026-10-12')?.consumo).toBe(10_000);
    expect(h.historial.find((d) => d.fecha === '2026-10-11')?.consumo).toBe(0);
  });
});
