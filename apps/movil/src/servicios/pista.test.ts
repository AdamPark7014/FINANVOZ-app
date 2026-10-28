import { describe, expect, it } from 'vitest';
import { obtenerHoy } from './hoy';
import { armarPista, pistaQuincena } from './pista';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** La pista a la quincena de D1 sale de aquí: días, lo que cae en cada uno y el ingreso; la pantalla solo la pinta. */
describe('pista a la quincena (B+, D1)', () => {
  const ev = (fecha: string, tipo: 'egreso' | 'tarjeta' | 'ingreso', concepto: string, monto: number) => ({
    fecha,
    tipo,
    concepto,
    monto,
  });

  it('armarPista: con cinco días o menos, todos; con su día de la semana y lo que cae en cada uno', () => {
    const { columnas, recortada } = armarPista('2026-10-26', '2026-10-30', [
      ev('2026-10-28', 'egreso', 'internet', 49_900),
      ev('2026-10-29', 'egreso', 'tanda', 50_000),
      ev('2026-10-29', 'tarjeta', 'Nu', 142_000),
      ev('2026-10-30', 'ingreso', 'quincena', 1_300_000),
      // Fuera de la pista: ayer y después del ingreso.
      ev('2026-10-25', 'egreso', 'luz', 30_000),
      ev('2026-10-31', 'egreso', 'renta', 450_000),
    ]);
    expect(recortada).toBe(false);
    expect(
      columnas.map((c) => [c.diaSemana, c.dia, c.hoy, c.ingreso, c.eventos.map((e) => e.concepto)]),
    ).toEqual([
      ['lun', 26, true, false, []],
      ['mar', 27, false, false, []],
      ['mié', 28, false, false, ['internet']],
      ['jue', 29, false, false, ['tanda', 'Nu']],
      ['vie', 30, false, true, ['quincena']],
    ]);
  });

  it('armarPista: si no cabe, hoy, los primeros días con algo fijo y el del ingreso', () => {
    const { columnas, recortada } = armarPista('2026-10-01', '2026-10-15', [
      ev('2026-10-03', 'egreso', 'luz', 30_000),
      ev('2026-10-05', 'egreso', 'agua', 20_000),
      ev('2026-10-09', 'egreso', 'gym', 40_000),
      ev('2026-10-12', 'egreso', 'tanda', 50_000),
      ev('2026-10-15', 'ingreso', 'quincena', 650_000),
    ]);
    expect(recortada).toBe(true);
    expect(columnas.map((c) => c.fecha)).toEqual([
      '2026-10-01',
      '2026-10-03',
      '2026-10-05',
      '2026-10-09',
      '2026-10-15',
    ]);
  });

  it('armarPista: el ingreso hoy deja una sola columna; un fin pasado, ninguna', () => {
    expect(armarPista('2026-10-15', '2026-10-15', []).columnas).toHaveLength(1);
    expect(armarPista('2026-10-15', '2026-10-14', []).columnas).toEqual([]);
  });

  it('pistaQuincena sobre e4-01: tanda el 13, internet el 14 y la quincena el 15 (los mismos de Hoy)', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    const v = obtenerHoy(p.ctx);
    const prox = v.proximoIngreso;
    expect(prox).not.toBeNull();
    if (!prox) return;
    const pista = pistaQuincena(p.ctx, prox);
    expect(pista.diasAlIngreso).toBe(4);
    expect(pista.recortada).toBe(false);
    expect(pista.columnas.map((c) => [c.dia, c.eventos.map((e) => [e.tipo, e.concepto, e.monto])])).toEqual([
      [11, []],
      [12, []],
      [13, [['egreso', 'tanda', 50_000]]],
      [14, [['egreso', 'internet', 67_400]]],
      [15, [['ingreso', 'quincena', 650_000]]],
    ]);
    // Lo apartado de la pista es lo mismo que E4 reserva en esos días (sin cálculos nuevos).
    const fijos = pista.columnas.flatMap((c) => c.eventos).filter((e) => e.tipo === 'egreso');
    const compromisos = v.reservadoDetalle.filter((r) => r.tipo === 'compromiso');
    expect(fijos.map((e) => e.monto)).toEqual(compromisos.map((r) => r.monto));
  });
});
