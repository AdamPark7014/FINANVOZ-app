import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { obtenerConsentimiento } from '../privacidad/consentimiento';
import { onboardingCompletado } from './ajustes';
import { listarCuentas } from './cuentas';
import { obtenerHoy } from './hoy';
import { listarOcurrencias } from './ocurrencias';
import { listarPersonas } from './personas';
import { cargarEscenario } from './semilla';
import { listarSuscripciones } from './suscripciones';
import { abrirPrueba, escenario } from './__pruebas__/base';

describe('cargador de escenarios semilla', () => {
  it('e4-01: cuentas, saldos en hoy − 1, ingreso con la última quincena cubierta y compromisos pendientes', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    expect(e.hoy).toBe('2026-10-11');
    expect(obtenerConsentimiento(p.ctx)?.medio).toBe('semilla');
    expect(onboardingCompletado(p.ctx)).toBe(true);
    const cuentas = listarCuentas(p.ctx);
    expect(cuentas.tienes.map((c) => [c.nombre, c.saldo])).toEqual([
      ['Cartera', 64_000],
      ['BBVA Débito ••5521', 359_000],
    ]);
    expect(cuentas.debes.map((c) => [c.nombre, c.saldo])).toEqual([['Nu ••4410', 200_000]]);
    const fechas = p.ctx.db.all<{ fecha: string }>(
      sql`SELECT DISTINCT fecha FROM transaccion WHERE tipo = 'saldo_inicial'`,
    );
    expect(fechas).toEqual([{ fecha: '2026-10-10' }]);
    expect(listarOcurrencias(p.ctx, { programadoId: e.ingresoId as string })[0]).toMatchObject({
      fecha: '2026-09-30',
      estado: 'cubierta',
    });
    expect(listarOcurrencias(p.ctx, { tipo: 'egreso' }).map((o) => [o.concepto, o.fecha, o.estado])).toEqual([
      ['tanda', '2026-10-13', 'pendiente'],
      ['internet', '2026-10-14', 'pendiente'],
      ['renta', '2026-10-31', 'pendiente'],
    ]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('e14-01: gastos E14-01 desde efectivo y catálogo vacío (CA-M10-01)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e14-01'));
    expect(e.hoy).toBe('2026-10-11');
    expect(e.catalogoSuscripciones).toEqual([]);
    const ctx = { ...p.ctx, catalogoSuscripciones: e.catalogoSuscripciones };
    const s = listarSuscripciones(ctx);
    expect(s.textoResumen).toBe('Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)');
    expect(s.activas.map((x) => x.nombre)).toEqual([
      'Estudio Yoga',
      'Smart Fit',
      'Netflix',
      'Spotify',
      'Dominio Web',
    ]);
    expect(s.inactivas.map((x) => x.nombre)).toEqual(['Disney Plus']);
    expect(s.activas.find((x) => x.nombre === 'Spotify')?.textoAntes).toBe('antes $115');
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('e5-10 y e-captura cargan (tres tarjetas; contacto que te debe)', () => {
    const a = abrirPrueba();
    cargarEscenario(a.ctx, escenario('e5-10'));
    expect(listarCuentas(a.ctx).debes.map((d) => d.nombre)).toEqual([
      'Banamex Oro ••8812',
      'Nu ••4410',
      'BBVA Azul ••1022',
    ]);
    const b = abrirPrueba();
    cargarEscenario(b.ctx, escenario('e-captura'));
    expect(listarPersonas(b.ctx)).toMatchObject([{ nombre: 'Carolina Pérez López', saldo: 30_000 }]);
    expect(listarCuentas(b.ctx).teDeben).toMatchObject([{ saldo: 30_000 }]);
    expect(obtenerHoy(b.ctx).estado).toBe('normal');
  });

  it('rechaza e-negocio (M11) y una base que ya tiene datos', () => {
    const p = abrirPrueba();
    expect(() => cargarEscenario(p.ctx, escenario('e-negocio'))).toThrow(
      expect.objectContaining({ codigo: 'escenario_no_soportado' }),
    );
    cargarEscenario(p.ctx, escenario('e4-01'));
    expect(() => cargarEscenario(p.ctx, escenario('e5-10'))).toThrow(
      expect.objectContaining({ codigo: 'base_no_vacia' }),
    );
    expect(() => cargarEscenario(p.ctx, { id: 'x' })).toThrow(
      expect.objectContaining({ codigo: 'escenario_invalido' }),
    );
  });
});
