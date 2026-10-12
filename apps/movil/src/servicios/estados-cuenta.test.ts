import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  construirGasto,
  construirPagoTarjeta,
  construirReembolso,
  type Centavos,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, idCategoria } from '@cartera/datos';
import { catalogoAnalizadores } from '../captura/analizadores';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import {
  ajustarSaldoConEstado,
  analizarEstadoCuentaPdf,
  guardarEstadoCuenta,
  type AnalisisEstadoCuenta,
  type LecturaEstadoCuenta,
} from './estados-cuenta';
import { agregarCuenta, agregarTarjetaCredito } from './onboarding';
import { abrirPrueba, estadoCuentaEsperado, paginasEstadoCuenta } from './__pruebas__/base';

const { transaccion, captura, transaccionVigente } = esquema;

interface Renglon {
  indice: number;
  fecha: PlainDate;
  descripcion: string;
  monto: Centavos;
  tipo: 'cargo' | 'comision' | 'pago' | 'abono';
}
interface EsperadoB {
  saldo_anterior: number;
  saldo_corte: number;
  corte: PlainDate;
  movimientos: Renglon[];
  msi: { cuota: number }[];
}

const B = estadoCuentaEsperado<EsperadoB>('banco_b');
const PAGINAS_B = paginasEstadoCuenta('banco_b');
const CUOTAS_MSI = B.msi.reduce((s, m) => s + m.cuota, 0);
/** Los que la captura "no vio": una compra, un pago y una bonificación. */
const FALTANTES = [7, 24, 37];

function listo(r: LecturaEstadoCuenta): AnalisisEstadoCuenta {
  if (r.tipo !== 'listo') throw new Error(`esperaba listo y fue ${r.tipo}`);
  return r.analisis;
}

/**
 * La Oro ••8812 dada de alta el 1 de septiembre con lo que debía al corte anterior (ya con las mensualidades de
 * este periodo, para que el saldo cuadre sin planes MSI en el libro) y los 42 renglones del estado de Banco B
 * registrados como los habría dejado la app, salvo `faltan`.
 */
function preparar(opciones: { faltan?: readonly number[]; diferenciaInicial?: number } = {}) {
  const p = abrirPrueba('2026-09-01');
  const { ctx } = p;
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const oro = agregarTarjetaCredito(ctx, {
    nombre: 'Oro',
    ultimos4: '8812',
    diaCorte: 10,
    diasParaPagar: 20,
    limiteCredito: 3_000_000,
    modo: 'totalero',
    saldo: B.saldo_anterior + CUOTAS_MSI - (opciones.diferenciaInicial ?? 0),
  }).cuentaId;
  p.reloj.fijar('2026-10-11');
  const faltan = new Set(opciones.faltan ?? FALTANTES);
  const registrar = (
    m: Renglon,
    mov: MovimientoPropuesto,
    extra: { fecha?: PlainDate; comercio?: string | null; origen?: 'voz' | 'notificacion' } = {},
  ) =>
    ctx.libro.registrar({
      tipo: mov.tipo,
      fecha: extra.fecha ?? m.fecha,
      origen: extra.origen ?? 'notificacion',
      claveIdempotencia: `prueba:${m.indice}`,
      asientos: mov.asientos,
      comercio: extra.comercio === undefined ? m.descripcion : extra.comercio,
    }).transaccion.id;
  for (const m of B.movimientos) {
    if (faltan.has(m.indice)) continue;
    const gasto = (pago: string) =>
      construirGasto({
        categoria: idCategoria(m.tipo === 'comision' ? 'comisiones_intereses' : 'otros_gastos'),
        pago,
        monto: m.monto,
      });
    if (m.indice === 11 || m.indice === 18) {
      // Dictados sin método de pago: quedaron en `por_asignar`, sin comercio.
      registrar(m, gasto(CUENTAS_SISTEMA.porAsignar), { origen: 'voz', comercio: null });
    } else if (m.tipo === 'pago') {
      registrar(m, construirPagoTarjeta({ tarjeta: oro, origen: bbva, monto: m.monto }));
    } else if (m.tipo === 'abono') {
      registrar(m, construirReembolso({ destino: oro, contra: idCategoria('reembolso'), monto: m.monto }));
    } else if (m.indice === 41) {
      // El IVA de la anualidad llegó (y se fechó) un día después del corte.
      registrar(m, gasto(oro), { fecha: '2026-10-11' });
    } else if (m.indice % 3 === 0) {
      // La notificación llegó un día después y con el comercio recortado.
      registrar(m, gasto(oro), { fecha: sumarUno(m.fecha), comercio: m.descripcion.split(' ')[0] ?? null });
    } else {
      registrar(m, gasto(oro));
    }
  }
  return { ...p, oro, bbva };
}

function sumarUno(f: PlainDate): PlainDate {
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function deudaAlCorte(p: ReturnType<typeof preparar>, corte: PlainDate = B.corte): number {
  return -p.ctx.libro.saldo(p.oro, corte);
}

describe('CA-M15-02 · 42 movimientos de los que 39 ya existen', () => {
  it('agrega exactamente 3 y no propone conciliación si el saldo coincide', () => {
    const p = preparar();
    const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
    expect(a).toMatchObject({
      tarjeta: { cuentaId: p.oro, nombre: 'Oro', ultimos4: '8812' },
      banco: 'Banco B',
      corte: '2026-10-10',
      limite: '2026-10-30',
      total: 42,
      yaLosTenias: 39,
      dudosos: [],
      anteriores: 0,
      renglonesSinLeer: 0,
      cuadra: true,
      saldoBanco: B.saldo_corte,
      saldoCartera: B.saldo_corte,
      coincide: true,
    });
    expect(a.nuevos.map((n) => [n.indice, n.tipo, n.categoria])).toStrictEqual([
      [7, 'cargo', 'super'],
      [24, 'pago', null],
      [37, 'abono', null],
    ]);

    const antes = p.ctx.db.select().from(transaccionVigente).all().length;
    const r = guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro });
    expect(r).toStrictEqual({ agregados: 3, conciliacion: null });
    const nuevas = p.ctx.db.select().from(transaccion).where(eq(transaccion.origen, 'estado_cuenta')).all();
    expect(nuevas.map((t) => [t.tipo, t.fecha, t.comercio])).toStrictEqual([
      ['gasto', '2026-09-16', 'SORIANA HIPER COYOACAN'],
      ['transferencia_pendiente', '2026-09-30', 'SU PAGO GRACIAS'],
      ['reembolso', '2026-10-08', 'BONIFICACION PROMOCION'],
    ]);
    // Los dos dictados en `por_asignar` pasaron a la tarjeta (reemplazo): +2 por ellos, +3 nuevos.
    expect(p.ctx.db.select().from(transaccionVigente).all().length).toBe(antes + 3);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(0);
    expect(deudaAlCorte(p)).toBe(B.saldo_corte - 10400); // el IVA quedó fechado después del corte
    // Cada renglón quedó revisado, sin texto del estado de cuenta.
    const filas = p.ctx.db.select().from(captura).where(eq(captura.fuente, 'estado_cuenta')).all();
    expect(filas).toHaveLength(42);
    expect(filas.every((f) => f.textoCrudo === null && f.estado === 'vinculada')).toBe(true);
    for (const f of filas) {
      expect(f.datos).not.toMatch(/OXXO|SORIANA|153275|\$/);
    }
  });

  it('volver a compartir el mismo PDF no duplica nada', () => {
    const p = preparar();
    guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro });
    const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
    expect(a).toMatchObject({ yaLosTenias: 42, nuevos: [], dudosos: [], coincide: true });
    expect(guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro })).toStrictEqual({
      agregados: 0,
      conciliacion: null,
    });
  });

  it('propone la conciliación si el saldo difiere y "Ajustar" deja la tarjeta como dice el banco', () => {
    const p = preparar({ diferenciaInicial: 15_000 });
    const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
    expect(a.nuevos).toHaveLength(3);
    expect(a.saldoCartera).toBe(B.saldo_corte - 15_000);
    expect(a.coincide).toBe(false);
    const r = guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro });
    expect(r.agregados).toBe(3);
    expect(r.conciliacion).toStrictEqual({
      tarjetaId: p.oro,
      nombreTarjeta: 'Oro',
      corte: '2026-10-10',
      saldoBanco: B.saldo_corte,
      saldoCartera: B.saldo_corte - 15_000,
    });
    const id = ajustarSaldoConEstado(p.ctx, r.conciliacion as NonNullable<typeof r.conciliacion>);
    const t = p.ctx.db
      .select()
      .from(transaccion)
      .where(eq(transaccion.id, id as string))
      .get();
    expect(t).toMatchObject({ tipo: 'conciliacion', fecha: '2026-10-10', origen: 'estado_cuenta' });
    expect(deudaAlCorte(p) + 10400).toBe(B.saldo_corte);
    // Ya cuadra: no se vuelve a proponer ni a ajustar.
    expect(listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B)).coincide).toBe(true);
    expect(ajustarSaldoConEstado(p.ctx, r.conciliacion as NonNullable<typeof r.conciliacion>)).toBeNull();
  });

  it('el estado de cuenta guardado actualiza el saldo del corte cerrado', () => {
    const p = preparar();
    analizarEstadoCuentaPdf(p.ctx, PAGINAS_B); // cierra los cortes pendientes, como al abrir la app
    const fila = () =>
      p.ctx.db
        .select()
        .from(esquema.estadoCuenta)
        .where(and(eq(esquema.estadoCuenta.tarjetaId, p.oro), eq(esquema.estadoCuenta.corte, B.corte)))
        .get();
    const antes = fila()?.saldoCorte as number;
    guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro });
    // Soriana, el pago y la bonificación nuevos, y los dos dictados que pasaron de `por_asignar` a la tarjeta.
    const cambio = 153275 - 950000 - 10000 + 189900 + 18500;
    expect(fila()?.saldoCorte).toBe(antes + cambio);
  });
});

describe('02 §26 · revisar antes de guardar', () => {
  it('un movimiento a dos días es dudoso: sin respuesta no se guarda; "es el mismo" lo vincula, "es otro" lo agrega', () => {
    for (const respuesta of ['mismo', 'otro'] as const) {
      const p = preparar({ faltan: [7] });
      // SORIANA registrada dos días después: E9.3 pregunta.
      p.ctx.libro.registrar({
        ...construirGasto({ categoria: idCategoria('super'), pago: p.oro, monto: 153275 }),
        fecha: '2026-09-18',
        origen: 'notificacion',
        claveIdempotencia: 'prueba:soriana',
        comercio: 'SORIANA',
      });
      const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
      expect(a.nuevos).toStrictEqual([]);
      expect(a.dudosos).toHaveLength(1);
      expect(a.dudosos[0]).toMatchObject({
        indice: 7,
        existente: { fecha: '2026-09-18', descripcion: 'SORIANA', monto: 153275 },
      });
      expect(() => guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro })).toThrow(
        expect.objectContaining({ codigo: 'dudosos_sin_respuesta' }),
      );
      const r = guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro, dudosos: { 7: respuesta } });
      expect(r.agregados).toBe(respuesta === 'mismo' ? 0 : 1);
    }
  });

  it('un nuevo que la persona quita no se agrega y ya no se vuelve a proponer', () => {
    const p = preparar();
    const r = guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro, omitir: [37] });
    expect(r.agregados).toBe(2);
    // La bonificación de $100 que no se agregó deja la deuda $100 arriba de lo que dice el banco.
    expect(r.conciliacion?.saldoCartera).toBe(B.saldo_corte + 10_000);
    const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
    expect(a).toMatchObject({ yaLosTenias: 42, nuevos: [] });
    const descartada = p.ctx.db
      .select()
      .from(captura)
      .where(and(eq(captura.fuente, 'estado_cuenta'), eq(captura.estado, 'descartada')))
      .all();
    expect(descartada).toHaveLength(1);
  });

  it('un movimiento del libro al cierre del periodo que el banco todavía no factura no hace diferencia', () => {
    const p = preparar();
    p.ctx.libro.registrar({
      ...construirGasto({ categoria: idCategoria('antojos'), pago: p.oro, monto: 4500 }),
      fecha: '2026-10-10',
      origen: 'notificacion',
      claveIdempotencia: 'prueba:en-camino',
      comercio: 'OXXO',
    });
    expect(listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B)).coincide).toBe(true);
    expect(guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: p.oro }).conciliacion).toBeNull();
  });
});

describe('qué tarjeta y qué estado de cuenta', () => {
  it('sin tarjetas, con varias posibles o con la tarjeta elegida', () => {
    const p = abrirPrueba('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    expect(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B)).toStrictEqual({
      tipo: 'sin_tarjetas',
      banco: 'Banco B',
    });
    const tarjeta = (nombre: string, ultimos4: string, institucion?: string) =>
      agregarTarjetaCredito(p.ctx, {
        nombre,
        ultimos4,
        ...(institucion ? { institucion } : {}),
        diaCorte: 10,
        diasParaPagar: 20,
        limiteCredito: 1_000_000,
        modo: 'totalero',
        saldo: 0,
      }).cuentaId;
    const otra = tarjeta('Otra', '1111');
    const r = analizarEstadoCuentaPdf(p.ctx, PAGINAS_B);
    expect(r).toMatchObject({
      tipo: 'elegir_tarjeta',
      banco: 'Banco B',
      ultimos4: '8812',
      corte: '2026-10-10',
    });
    // La persona elige: el estado es de antes del alta de esa tarjeta.
    expect(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B, { tarjetaId: otra })).toMatchObject({
      tipo: 'anterior_al_alta',
      tarjeta: { cuentaId: otra },
    });
    expect(() => analizarEstadoCuentaPdf(p.ctx, PAGINAS_B, { tarjetaId: 'nada' })).toThrow(
      expect.objectContaining({ codigo: 'tarjeta_inexistente' }),
    );
    // Misma terminación en otro banco no cuenta; con el mismo banco o sin banco, sí.
    tarjeta('De otro banco', '8812', 'banco_e');
    expect(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B).tipo).toBe('elegir_tarjeta');
    tarjeta('Oro', '8812', 'banco_b');
    expect(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B)).toMatchObject({ tipo: 'anterior_al_alta' });
  });

  it('lo de antes del alta ya está en el saldo inicial: no se propone', () => {
    const p = abrirPrueba('2026-09-25');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const oro = agregarTarjetaCredito(p.ctx, {
      nombre: 'Oro',
      ultimos4: '8812',
      diaCorte: 10,
      diasParaPagar: 20,
      limiteCredito: 3_000_000,
      modo: 'totalero',
      saldo: 0,
    }).cuentaId;
    p.reloj.fijar('2026-10-11');
    const a = listo(analizarEstadoCuentaPdf(p.ctx, PAGINAS_B));
    expect(a.tarjeta.cuentaId).toBe(oro);
    const anteriores = B.movimientos.filter((m) => m.fecha < '2026-09-25').length;
    expect(a.anteriores).toBe(anteriores);
    expect(a.nuevos).toHaveLength(42 - anteriores);
  });

  it('escaneado, banco desconocido o estado incompleto', () => {
    const p = abrirPrueba('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    expect(analizarEstadoCuentaPdf(p.ctx, [''])).toStrictEqual({ tipo: 'escaneado' });
    const otro = ['ESTADO DE CUENTA DE OTRO BANCO SIN ANALIZADOR '.repeat(3)];
    expect(analizarEstadoCuentaPdf(p.ctx, otro)).toStrictEqual({
      tipo: 'no_reconocido',
      bancos: ['Banco B', 'Banco E', 'Banco F'],
    });
    // Un build de producción solo trae los analizadores reales (hoy ninguno).
    expect(
      analizarEstadoCuentaPdf(p.ctx, PAGINAS_B, { catalogo: catalogoAnalizadores(false) }),
    ).toStrictEqual({
      tipo: 'no_reconocido',
      bancos: [],
    });
    const sinCorte = [(PAGINAS_B[0] as string).replace(/^Fecha de corte:.*$/m, '')];
    expect(analizarEstadoCuentaPdf(p.ctx, sinCorte)).toStrictEqual({ tipo: 'incompleto', banco: 'Banco B' });
    expect(() => guardarEstadoCuenta(p.ctx, sinCorte, { tarjetaId: 'x' })).toThrow(
      expect.objectContaining({ codigo: 'estado_cuenta_invalido' }),
    );
  });

  it('Banco E y Banco F también se leen y se completan', () => {
    for (const [banco, ultimos4, diaCorte] of [
      ['banco_e', '4410', 28],
      ['banco_f', '1022', 31],
    ] as const) {
      const p = abrirPrueba('2026-08-01');
      aceptarConsentimiento(p.ctx, { datosFinancieros: true });
      agregarTarjetaCredito(p.ctx, {
        nombre: banco,
        ultimos4,
        diaCorte,
        diasParaPagar: 20,
        limiteCredito: 1_000_000,
        modo: 'totalero',
        saldo: 0,
      });
      p.reloj.fijar('2026-10-11');
      const esperado = estadoCuentaEsperado<{ movimientos: unknown[] }>(banco);
      const a = listo(analizarEstadoCuentaPdf(p.ctx, paginasEstadoCuenta(banco)));
      expect(a.nuevos).toHaveLength(esperado.movimientos.length);
      const r = guardarEstadoCuenta(p.ctx, paginasEstadoCuenta(banco), { tarjetaId: a.tarjeta.cuentaId });
      expect(r.agregados).toBe(esperado.movimientos.length);
    }
  });

  it('sin consentimiento no se guarda', () => {
    const p = abrirPrueba('2026-10-11');
    expect(() => guardarEstadoCuenta(p.ctx, PAGINAS_B, { tarjetaId: 'x' })).toThrow(
      expect.objectContaining({ codigo: 'sin_consentimiento' }),
    );
  });
});
