import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarCuentas } from './cuentas';
import { registrarMovimiento } from './formulario';
import { agruparPorCategoria, enQueSeFue, totalesDelMes } from './movimientos';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** «En qué se fue» (B+, D5) y «Lo que viene» con ingresos (D6) salen de aquí; la pantalla solo los pinta. */
describe('En qué se fue (D5)', () => {
  const m = (
    slug: string | null,
    nombre: string | null,
    monto: number,
    sentido: 'salida' | 'entrada' = 'salida',
  ) => ({
    sentido,
    monto,
    categoriaSlug: slug,
    categoria: nombre,
  });

  it('agrupa lo que salió por categoría, de mayor a menor, y suma el total; lo que entra no cuenta', () => {
    const r = agruparPorCategoria([
      m('antojos', 'Antojos', 2_500),
      m('vivienda', 'Vivienda', 450_000),
      m('antojos', 'Antojos', 18_000),
      m('super', 'Súper', 164_000),
      m('sueldo', 'Sueldo', 1_300_000, 'entrada'),
    ]);
    expect(r.categorias.map((c) => [c.nombre, c.monto])).toEqual([
      ['Vivienda', 450_000],
      ['Súper', 164_000],
      ['Antojos', 20_500],
    ]);
    expect(r.total).toBe(634_500);
  });

  it('lo que no tiene categoría y lo que no cabe va a «Otros», al final; la suma siempre da el total', () => {
    const r = agruparPorCategoria(
      [
        m('a', 'A', 700),
        m('b', 'B', 600),
        m('c', 'C', 500),
        m('d', 'D', 400),
        m(null, null, 50),
        m('e', 'E', 300),
        m('f', 'F', 200),
      ],
      4,
    );
    expect(r.categorias.map((c) => [c.slug, c.nombre, c.monto])).toEqual([
      ['a', 'A', 700],
      ['b', 'B', 600],
      ['c', 'C', 500],
      [null, 'Otros', 950],
    ]);
    expect(r.categorias.reduce((s, c) => s + c.monto, 0)).toBe(r.total);
    expect(agruparPorCategoria([]).categorias).toEqual([]);
  });

  it('enQueSeFue sobre el libro: la suma da lo que salió en el mes (el «salieron» de la frase de arriba)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const efectivo = e.cuentas['efectivo'] as string;
    const bbva = e.cuentas['bbva'] as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 2_500,
      fecha: '2026-10-11',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'super',
      origenId: bbva,
      monto: 32_500,
      fecha: '2026-10-10',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 9_900,
      fecha: '2026-09-30',
    });
    const r = enQueSeFue(p.ctx);
    expect(r.total).toBe(totalesDelMes(p.ctx).salieron);
    expect(r.categorias.reduce((s, c) => s + c.monto, 0)).toBe(r.total);
    expect(r.categorias.find((c) => c.slug === 'antojos')?.monto).toBe(2_500);
  });
});

describe('Lo que viene con ingresos y el último conteo del efectivo (D6)', () => {
  it('compromisos e ingresos de los próximos 30 días por fecha; el efectivo sin contar no tiene fecha', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    const v = listarCuentas(p.ctx);
    expect(v.loQueViene.map((x) => [x.fecha, x.tipo, x.concepto])).toEqual([
      ['2026-10-13', 'egreso', 'tanda'],
      ['2026-10-14', 'egreso', 'internet'],
      ['2026-10-15', 'ingreso', 'quincena'],
      ['2026-10-30', 'ingreso', 'quincena'],
      ['2026-10-31', 'egreso', 'renta'],
    ]);
    // Los compromisos de siempre no cambian.
    expect(v.compromisos.map((c) => c.concepto)).toEqual(['tanda', 'internet', 'renta']);
    expect(v.tienes.map((c) => c.contadaEl)).toEqual([null, null]);
  });
});
