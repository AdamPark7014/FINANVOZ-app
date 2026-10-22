import { describe, expect, it } from 'vitest';
import { ErrorDominio, type PlainDate } from '@cartera/core';
import { fijarColchon } from './ajustes';
import { registrarMovimiento } from './formulario';
import { marcarExtraordinaria } from './historial';
import { calcularLibre, obtenerHoy } from './hoy';
import { confirmarIngresoRecibido, materializarOcurrencias, yaLaPague } from './ocurrencias';
import { agregarPagoFijo } from './onboarding';
import {
  marcarObservacionVista,
  MAX_OBSERVACIONES,
  obtenerObservaciones,
  observacionesVistas,
  type Observacion,
} from './observaciones';
import { cargarEscenario } from './semilla';
import { procesarSuscripciones, yaLaCancele } from './suscripciones';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** Instante UTC de un día a las 10:00 de la Ciudad de México (UTC−6). */
const instante = (fecha: PlainDate, hora = 10, minutos = 0) => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d, hora + 6, minutos);
};

/**
 * Libro armado a mano con reloj fijo: efectivo y débito desde `inicio` (así `inicio_uso` queda ahí), una
 * quincena (15 y último, con ajuste al día hábil anterior) ya recibida el 31 ago, 15 sep y 30 sep, y `hoy`.
 */
function libro(
  opciones: {
    hoy?: PlainDate;
    inicio?: PlainDate;
    ultimoRecibido?: PlainDate;
    conIngreso?: boolean;
  } = {},
) {
  const hoy = opciones.hoy ?? '2026-10-11';
  const inicio = opciones.inicio ?? '2026-09-01';
  const conIngreso = opciones.conIngreso ?? true;
  const p = abrirPrueba(inicio);
  const e = cargarEscenario(p.ctx, {
    id: 'observaciones',
    hoy: inicio,
    colchon: 20_000,
    ...(conIngreso
      ? {
          ingreso: {
            concepto: 'quincena',
            monto: 650_000,
            regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' },
            cuenta: 'bbva',
            ultimo_recibido: opciones.ultimoRecibido ?? '2026-08-31',
          },
        }
      : {}),
    cuentas: [
      { clave: 'efectivo', subtipo: 'efectivo', nombre: 'Cartera', saldo: 500_000, alias: ['efectivo'] },
      { clave: 'bbva', subtipo: 'debito', nombre: 'BBVA', saldo: 2_000_000, alias: ['bbva'] },
    ],
  });
  p.reloj.fijar(hoy);
  const efectivo = e.cuentas['efectivo'] as string;
  const bbva = e.cuentas['bbva'] as string;
  if (conIngreso && e.ingresoId) {
    materializarOcurrencias(p.ctx);
    for (const fecha of ['2026-09-15', '2026-09-30'] as const) {
      if (fecha <= hoy && fecha > (opciones.ultimoRecibido ?? '2026-08-31')) {
        confirmarIngresoRecibido(p.ctx, {
          programadoId: e.ingresoId,
          fecha,
          destinoId: bbva,
          fechaPago: fecha,
        });
      }
    }
  }
  const gasto = (
    fecha: PlainDate,
    monto: number,
    categoria: string,
    extra: { comercio?: string; descripcion?: string; porRevisar?: boolean } = {},
  ) =>
    registrarMovimiento(
      p.ctx,
      {
        tipo: 'gasto',
        fecha,
        monto,
        categoria,
        origenId: efectivo,
        ...(extra.comercio ? { comercio: extra.comercio } : {}),
        ...(extra.descripcion ? { descripcion: extra.descripcion } : {}),
      },
      extra.porRevisar ? { porRevisar: true } : {},
    ).transaccionId;
  return { p, ctx: p.ctx, efectivo, bbva, ingresoId: e.ingresoId, gasto };
}

const tipos = (lista: readonly Observacion[]) => lista.map((o) => o.tipo);
const buscar = <T extends Observacion['tipo']>(lista: readonly Observacion[], tipo: T) =>
  lista.find((o): o is Extract<Observacion, { tipo: T }> => o.tipo === tipo) ?? null;

describe('observaciones · generales', () => {
  it('con la semilla e4-01 (sin gastos) no hay observaciones y el resultado es determinista', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    expect(obtenerObservaciones(p.ctx)).toEqual([]);
    expect(obtenerObservaciones(p.ctx)).toEqual(obtenerObservaciones(p.ctx));
    // Leer observaciones no cambia Hoy.
    expect(obtenerHoy(p.ctx).hoyPuedesPesos).toBe(214);
  });

  it('devuelve a lo más dos, por relevancia (doble, inusual, ritmo, comparativa); "Ya lo vi" deja pasar la siguiente', () => {
    const { ctx, gasto, p } = libro();
    // Comparativa: comida fuera $1,240 ahora contra $980 en los mismos días de la quincena anterior.
    gasto('2026-10-02', 40_000, 'comida_fuera');
    gasto('2026-10-05', 44_000, 'comida_fuera');
    gasto('2026-10-08', 40_000, 'comida_fuera');
    gasto('2026-09-16', 50_000, 'comida_fuera');
    gasto('2026-09-20', 48_000, 'comida_fuera');
    // Inusual: ropa $1,850 ayer contra una mediana de $500.
    for (const [f, m] of [
      ['2026-09-02', 50_000],
      ['2026-09-05', 60_000],
      ['2026-09-08', 40_000],
      ['2026-09-12', 55_000],
      ['2026-09-20', 50_000],
      ['2026-09-25', 45_000],
    ] as const) {
      gasto(f, m, 'ropa');
    }
    gasto('2026-10-10', 185_000, 'ropa');
    // Doble: dos cargos de Netflix hoy (registrados con fecha pasada según el reloj fijo: basta el mismo día).
    gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });

    const primeras = obtenerObservaciones(ctx);
    expect(primeras).toHaveLength(MAX_OBSERVACIONES);
    expect(tipos(primeras)).toEqual(['doble', 'inusual']);
    expect(obtenerObservaciones(ctx)).toEqual(primeras);

    const doble = primeras[0] as Observacion;
    marcarObservacionVista(ctx, doble.clave);
    expect(tipos(obtenerObservaciones(ctx))).toEqual(['inusual', 'ritmo']);
    const inusual = obtenerObservaciones(ctx)[0] as Observacion;
    marcarObservacionVista(ctx, inusual.clave);
    expect(tipos(obtenerObservaciones(ctx))).toEqual(['ritmo', 'comparativa']);
    expect(observacionesVistas(ctx)).toEqual({ [doble.clave]: '2026-10-11', [inusual.clave]: '2026-10-11' });

    // Una clave que no es de observación no se guarda.
    expect(() => marcarObservacionVista(ctx, 'aviso:otra')).toThrow(ErrorDominio);

    // Las vistas de más de 90 días se olvidan al marcar otra.
    p.reloj.fijar('2027-01-15');
    marcarObservacionVista(ctx, 'ritmo:2027-01-15');
    expect(Object.keys(observacionesVistas(ctx))).toEqual(['ritmo:2027-01-15']);
  });
});

describe('observaciones · comparativa por categoría', () => {
  it('sale con ≥ 20 % y ≥ $200 de diferencia contra los mismos días de la quincena anterior', () => {
    const { ctx, gasto } = libro();
    gasto('2026-10-02', 40_000, 'comida_fuera');
    gasto('2026-10-05', 44_000, 'comida_fuera');
    gasto('2026-10-08', 40_000, 'comida_fuera');
    gasto('2026-09-16', 50_000, 'comida_fuera');
    gasto('2026-09-20', 48_000, 'comida_fuera');
    // Fuera de los 12 días comparados (15–26 sep): no cuenta.
    gasto('2026-09-28', 60_000, 'comida_fuera');
    const o = buscar(obtenerObservaciones(ctx), 'comparativa');
    expect(o).toMatchObject({
      clave: 'comparativa:comida_fuera:2026-09-30',
      cifra: 124_000,
      actual: 124_000,
      anterior: 98_000,
      categoria: 'comida_fuera',
      nombreCategoria: 'comida fuera',
      periodo: { inicio: '2026-09-30', concepto: 'quincena' },
      filtro: { desde: '2026-09-30', hasta: '2026-10-11', soloGastos: true, categorias: ['comida_fuera'] },
    });
  });

  it('también sale hacia abajo y compara la categoría con más gasto del periodo', () => {
    const { ctx, gasto } = libro();
    gasto('2026-10-03', 30_000, 'transporte');
    gasto('2026-10-03', 70_000, 'super');
    gasto('2026-09-17', 100_000, 'super');
    gasto('2026-09-17', 100_000, 'transporte');
    const o = buscar(obtenerObservaciones(ctx), 'comparativa');
    expect(o).toMatchObject({ categoria: 'super', actual: 70_000, anterior: 100_000 });
  });

  it('no sale con menos de $200 ni con menos de 20 % de diferencia', () => {
    const a = libro();
    a.gasto('2026-10-02', 124_000, 'comida_fuera');
    a.gasto('2026-09-16', 110_000, 'comida_fuera');
    expect(buscar(obtenerObservaciones(a.ctx), 'comparativa')).toBeNull();

    const b = libro();
    b.gasto('2026-10-02', 242_000, 'comida_fuera');
    b.gasto('2026-09-16', 220_000, 'comida_fuera');
    expect(buscar(obtenerObservaciones(b.ctx), 'comparativa')).toBeNull();
  });

  it('no sale si el periodo anterior no está completo en el historial (regla 12)', () => {
    // La persona empezó el 20 sep: la quincena anterior (desde el 15) no está completa.
    const { ctx, gasto } = libro({ inicio: '2026-09-20', ultimoRecibido: '2026-09-15' });
    gasto('2026-10-02', 300_000, 'comida_fuera');
    gasto('2026-09-22', 10_000, 'comida_fuera');
    expect(buscar(obtenerObservaciones(ctx), 'comparativa')).toBeNull();
  });

  it('sin ingreso que defina horizonte compara con el mes pasado', () => {
    const { ctx, gasto } = libro({ conIngreso: false, inicio: '2026-07-01' });
    gasto('2026-10-03', 80_000, 'comida_fuera');
    gasto('2026-09-03', 40_000, 'comida_fuera');
    // 12 sep queda fuera de los 11 días comparados (1–11 sep).
    gasto('2026-09-12', 90_000, 'comida_fuera');
    const o = buscar(obtenerObservaciones(ctx), 'comparativa');
    expect(o).toMatchObject({
      clave: 'comparativa:comida_fuera:2026-10-01',
      actual: 80_000,
      anterior: 40_000,
      periodo: { inicio: '2026-10-01', concepto: null },
    });
  });
});

describe('observaciones · gasto fuera de lo normal', () => {
  const previos = [
    ['2026-09-02', 50_000],
    ['2026-09-05', 60_000],
    ['2026-09-08', 40_000],
    ['2026-09-12', 55_000],
    ['2026-09-20', 50_000],
    ['2026-09-25', 45_000],
  ] as const;

  it('sale con un gasto de los últimos 3 días ≥ 3 veces la mediana de los previos de su categoría', () => {
    const { ctx, gasto } = libro();
    for (const [f, m] of previos) gasto(f, m, 'ropa');
    const id = gasto('2026-10-10', 185_000, 'ropa');
    const o = buscar(obtenerObservaciones(ctx), 'inusual');
    expect(o).toMatchObject({
      clave: `inusual:${id}`,
      cifra: 185_000,
      transaccionId: id,
      categoria: 'ropa',
      nombreCategoria: 'ropa',
      monto: 185_000,
      fecha: '2026-10-10',
      cuando: 'ayer',
      mediana: 50_000,
      filtro: { desde: '2026-09-02', hasta: '2026-10-11', soloGastos: true, categorias: ['ropa'] },
    });
  });

  it('dice hoy y antier según el día', () => {
    const a = libro();
    for (const [f, m] of previos) a.gasto(f, m, 'ropa');
    a.gasto('2026-10-11', 185_000, 'ropa');
    expect(buscar(obtenerObservaciones(a.ctx), 'inusual')?.cuando).toBe('hoy');
    const b = libro();
    for (const [f, m] of previos) b.gasto(f, m, 'ropa');
    b.gasto('2026-10-09', 185_000, 'ropa');
    expect(buscar(obtenerObservaciones(b.ctx), 'inusual')?.cuando).toBe('antier');
  });

  it('no sale con menos de 3 veces la mediana, menos de 5 previos, más de 3 días o marcado extraordinario', () => {
    const a = libro();
    for (const [f, m] of previos) a.gasto(f, m, 'ropa');
    a.gasto('2026-10-10', 140_000, 'ropa');
    expect(buscar(obtenerObservaciones(a.ctx), 'inusual')).toBeNull();

    const b = libro();
    for (const [f, m] of previos.slice(0, 4)) b.gasto(f, m, 'ropa');
    b.gasto('2026-10-10', 185_000, 'ropa');
    expect(buscar(obtenerObservaciones(b.ctx), 'inusual')).toBeNull();

    const c = libro();
    for (const [f, m] of previos) c.gasto(f, m, 'ropa');
    c.gasto('2026-10-07', 185_000, 'ropa');
    expect(buscar(obtenerObservaciones(c.ctx), 'inusual')).toBeNull();

    const d = libro();
    for (const [f, m] of previos) d.gasto(f, m, 'ropa');
    const id = d.gasto('2026-10-10', 185_000, 'ropa');
    marcarExtraordinaria(d.ctx, id, true);
    expect(buscar(obtenerObservaciones(d.ctx), 'inusual')).toBeNull();
  });

  it('no sale por debajo de $300 aunque sea 3 veces la mediana', () => {
    const { ctx, gasto } = libro();
    for (const f of ['2026-09-02', '2026-09-05', '2026-09-08', '2026-09-12', '2026-09-20'] as const) {
      gasto(f, 5_000, 'antojos');
    }
    gasto('2026-10-11', 20_000, 'antojos');
    expect(buscar(obtenerObservaciones(ctx), 'inusual')).toBeNull();
  });
});

describe('observaciones · posible cargo doble', () => {
  it('sale con dos cargos iguales del mismo comercio registrados a ≤ 2 horas el día que ocurrieron', () => {
    const { ctx, gasto, p } = libro();
    p.reloj.fijarInstante(instante('2026-10-11'));
    const a = gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    p.reloj.fijarInstante(instante('2026-10-11', 11, 30));
    const b = gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    const o = buscar(obtenerObservaciones(ctx), 'doble');
    const [primero, segundo] = [a, b].sort();
    expect(o).toMatchObject({
      clave: `doble:${primero}:${segundo}`,
      cifra: 24_900,
      transacciones: [primero, segundo],
      monto: 24_900,
      fecha: '2026-10-11',
      cuando: 'hoy',
      etiquetaFecha: 'dom 11',
      comercio: 'Netflix',
      descripcion: null,
      filtro: { desde: '2026-10-11', hasta: '2026-10-11', soloGastos: true },
    });
  });

  it('no sale si se registraron a más de 2 horas el día que ocurrieron', () => {
    const { ctx, gasto, p } = libro();
    p.reloj.fijarInstante(instante('2026-10-11'));
    gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    p.reloj.fijarInstante(instante('2026-10-11', 13, 30));
    gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    expect(buscar(obtenerObservaciones(ctx), 'doble')).toBeNull();
  });

  it('con fecha pasada basta el mismo día, y la fecha se dice con el día de la semana', () => {
    const { ctx, gasto, p } = libro();
    p.reloj.fijarInstante(instante('2026-10-11'));
    gasto('2026-10-09', 24_900, 'suscripciones', { comercio: 'Netflix' });
    p.reloj.fijarInstante(instante('2026-10-11', 15));
    gasto('2026-10-09', 24_900, 'suscripciones', { comercio: 'Netflix' });
    expect(buscar(obtenerObservaciones(ctx), 'doble')).toMatchObject({
      fecha: '2026-10-09',
      cuando: 'otro',
      etiquetaFecha: 'vie 9',
    });
  });

  it('sin comercio compara la descripción normalizada', () => {
    const { ctx, gasto } = libro();
    gasto('2026-10-10', 8_000, 'comida_fuera', { descripcion: 'Tacos' });
    gasto('2026-10-10', 8_000, 'comida_fuera', { descripcion: 'tacos' });
    expect(buscar(obtenerObservaciones(ctx), 'doble')).toMatchObject({
      comercio: null,
      descripcion: 'tacos',
      cuando: 'ayer',
    });
  });

  it('no sale con montos distintos, comercios distintos, días distintos, más de 7 días o por revisar', () => {
    const { ctx, gasto } = libro();
    gasto('2026-10-11', 24_900, 'suscripciones', { comercio: 'Netflix' });
    gasto('2026-10-11', 21_900, 'suscripciones', { comercio: 'Netflix' });
    gasto('2026-10-11', 12_900, 'suscripciones', { comercio: 'Spotify' });
    gasto('2026-10-11', 12_900, 'suscripciones', { comercio: 'Disney' });
    gasto('2026-10-09', 9_900, 'suscripciones', { comercio: 'HBO' });
    gasto('2026-10-10', 9_900, 'suscripciones', { comercio: 'HBO' });
    gasto('2026-10-03', 15_000, 'suscripciones', { comercio: 'Prime' });
    gasto('2026-10-03', 15_000, 'suscripciones', { comercio: 'Prime' });
    gasto('2026-10-11', 5_000, 'antojos', { comercio: 'OXXO' });
    gasto('2026-10-11', 5_000, 'antojos', { comercio: 'OXXO', porRevisar: true });
    expect(buscar(obtenerObservaciones(ctx), 'doble')).toBeNull();
  });
});

describe('observaciones · ritmo del periodo', () => {
  it('sale cuando la brecha entre días transcurridos y gastado de lo libre es ≥ 25 puntos', () => {
    const { ctx, gasto } = libro();
    gasto('2026-10-02', 100_000, 'comida_fuera');
    const c = calcularLibre(ctx);
    const o = buscar(obtenerObservaciones(ctx), 'ritmo');
    expect(o).toMatchObject({
      clave: 'ritmo:2026-09-30',
      cifra: 100_000,
      gastado: 100_000,
      libreInicial: c.r.libre + 100_000,
      diasTranscurridos: 12,
      diasTotales: 15,
      porcentajeDias: 80,
      porcentajeGastado: 3,
      periodo: { inicio: '2026-09-30', concepto: 'quincena' },
      filtro: { desde: '2026-09-30', hasta: '2026-10-11', soloGastos: true },
    });
  });

  it('lo que cubrió un compromiso no cuenta como gastado de lo libre', () => {
    const { ctx, gasto, p, bbva } = libro();
    gasto('2026-10-02', 100_000, 'comida_fuera');
    p.reloj.fijar('2026-10-01');
    const programadoId = agregarPagoFijo(ctx, {
      concepto: 'renta',
      monto: 450_000,
      regla: { tipo: 'unica', fecha: '2026-10-05' },
      cuentaId: bbva,
    });
    p.reloj.fijar('2026-10-11');
    materializarOcurrencias(ctx);
    const antes = calcularLibre(ctx).r.libre;
    yaLaPague(ctx, { programadoId, fecha: '2026-10-05', fechaPago: '2026-10-05' });
    expect(calcularLibre(ctx).r.libre).toBe(antes);
    expect(buscar(obtenerObservaciones(ctx), 'ritmo')).toMatchObject({ gastado: 100_000 });
  });

  it('no sale con brecha menor a 25 puntos, con libre negativo, sin ingreso ni con el periodo fuera del historial', () => {
    const a = libro();
    a.gasto('2026-10-02', 100_000, 'comida_fuera');
    // libre = 25,000 → gastado 100,000 de 125,000 = 80 %, igual que los días (12 de 15).
    fijarColchon(a.ctx, calcularLibre(a.ctx).l - 25_000);
    expect(calcularLibre(a.ctx).r.libre).toBe(25_000);
    expect(buscar(obtenerObservaciones(a.ctx), 'ritmo')).toBeNull();

    fijarColchon(a.ctx, calcularLibre(a.ctx).l + 1);
    expect(calcularLibre(a.ctx).r.libre).toBeLessThan(0);
    expect(buscar(obtenerObservaciones(a.ctx), 'ritmo')).toBeNull();

    const b = libro({ conIngreso: false });
    b.gasto('2026-10-02', 100_000, 'comida_fuera');
    expect(buscar(obtenerObservaciones(b.ctx), 'ritmo')).toBeNull();

    const c = libro({ inicio: '2026-10-05', ultimoRecibido: '2026-09-30' });
    c.gasto('2026-10-06', 100_000, 'comida_fuera');
    expect(buscar(obtenerObservaciones(c.ctx), 'ritmo')).toBeNull();
  });
});

describe('observaciones · suscripciones del mes', () => {
  const cargos = (
    gasto: ReturnType<typeof libro>['gasto'],
    comercio: string,
    monto: number,
    fechas: readonly PlainDate[],
  ) => {
    for (const f of fechas) gasto(f, monto, 'suscripciones', { comercio });
  };

  it('suma los cargos del mes de las suscripciones que E14 ya detectó, con ≥ 2', () => {
    const { ctx, gasto } = libro({ conIngreso: false, inicio: '2026-07-01', hoy: '2026-10-20' });
    cargos(gasto, 'Netflix', 21_900, ['2026-07-14', '2026-08-14', '2026-09-14', '2026-10-14']);
    cargos(gasto, 'Spotify', 12_900, ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05']);
    procesarSuscripciones(ctx);
    const o = buscar(obtenerObservaciones(ctx), 'suscripciones');
    expect(o).toMatchObject({
      clave: 'suscripciones:2026-10',
      cifra: 34_800,
      total: 34_800,
      cantidad: 2,
      mes: '2026-10',
      filtro: { desde: '2026-10-01', hasta: '2026-10-20', soloGastos: true, categorias: ['suscripciones'] },
    });
  });

  it('no sale con una sola suscripción cobrada este mes ni con una cancelada', () => {
    const a = libro({ conIngreso: false, inicio: '2026-07-01', hoy: '2026-10-20' });
    cargos(a.gasto, 'Netflix', 21_900, ['2026-07-14', '2026-08-14', '2026-09-14', '2026-10-14']);
    cargos(a.gasto, 'Spotify', 12_900, ['2026-07-05', '2026-08-05', '2026-09-05']);
    procesarSuscripciones(a.ctx);
    expect(buscar(obtenerObservaciones(a.ctx), 'suscripciones')).toBeNull();

    const b = libro({ conIngreso: false, inicio: '2026-07-01', hoy: '2026-10-20' });
    cargos(b.gasto, 'Netflix', 21_900, ['2026-07-14', '2026-08-14', '2026-09-14', '2026-10-14']);
    cargos(b.gasto, 'Spotify', 12_900, ['2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05']);
    procesarSuscripciones(b.ctx);
    expect(buscar(obtenerObservaciones(b.ctx), 'suscripciones')).not.toBeNull();
    yaLaCancele(b.ctx, 'SPOTIFY');
    expect(buscar(obtenerObservaciones(b.ctx), 'suscripciones')).toBeNull();
  });
});
