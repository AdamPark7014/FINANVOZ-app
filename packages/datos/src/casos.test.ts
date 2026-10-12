import { afterEach, describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import { abrirBase, C, type BaseDePrueba } from './__pruebas__/base';
import type { TransaccionNueva, TransaccionRegistrada } from './libro';
import {
  construirAjusteArqueo,
  construirAportacionTanda,
  construirCobroPrestamo,
  construirCobroTanda,
  construirCompraMsi,
  construirConciliacion,
  construirCuentaDividida,
  construirGasto,
  construirIngreso,
  construirLiquidacionMsi,
  construirMsiExistente,
  construirPagoPrestamo,
  construirPagoRecibidoPendiente,
  construirPagoTarjeta,
  construirPrestamoOtorgado,
  construirPrestamoRecibido,
  construirReclasificacionMsi,
  construirReembolso,
  construirRetiroEfectivo,
  construirSalidaPendiente,
  construirSaldoInicial,
  construirTransferencia,
  type MovimientoPropuesto,
} from './nucleo';

/**
 * CA-M1-04 · Cada caso de `docs/04-DATOS.md §4` del 1 al 23b, con sus variantes, produce exactamente los
 * asientos documentados. Montos en centavos ($25 = 2500).
 */

const FECHA = '2026-10-12';
let base: BaseDePrueba;
let n = 0;

function nueva(m: MovimientoPropuesto, extra: Partial<TransaccionNueva> = {}): TransaccionNueva {
  return {
    tipo: m.tipo,
    asientos: m.asientos,
    estimada: m.estimada ?? false,
    fecha: FECHA,
    origen: 'texto',
    claveIdempotencia: m.claveIdempotencia ?? `clave-${++n}`,
    ...extra,
  };
}

function registrar(m: MovimientoPropuesto, extra: Partial<TransaccionNueva> = {}): TransaccionRegistrada {
  const r = base.libro.registrar(nueva(m, extra));
  expect(r.nueva).toBe(true);
  return r.transaccion;
}

function reemplazar(id: string, m: MovimientoPropuesto, extra: Partial<TransaccionNueva> = {}) {
  return base.libro.reemplazar(id, nueva(m, extra));
}

const asientos = (t: TransaccionRegistrada) => t.asientos.map((a) => [a.cuentaId, a.monto]);
const saldo = (cuenta: string) => base.libro.saldo(cuenta);

function nuevaBase() {
  base = abrirBase();
}

afterEach(() => {
  expect(base.libro.comprobarIntegridad()).toEqual([]);
  base.cliente.close();
});

describe('CA-M1-04 · asientos por caso (04 §4)', () => {
  it('1 · "Coca de 25 en efectivo" → gasto', () => {
    nuevaBase();
    const t = registrar(construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 2500 }));
    expect(t.tipo).toBe('gasto');
    expect(asientos(t)).toEqual([
      [C.antojos, 2500],
      [C.efectivo, -2500],
    ]);
  });

  it('2 · "Tacos de 80 con la Nu" → gasto', () => {
    nuevaBase();
    const t = registrar(construirGasto({ categoria: C.comidaFuera, pago: C.nu, monto: 8000 }));
    expect(t.tipo).toBe('gasto');
    expect(asientos(t)).toEqual([
      [C.comidaFuera, 8000],
      [C.nu, -8000],
    ]);
  });

  it('3 · "Pagué 2,000 de la Nu desde BBVA" → pago_tarjeta (no es gasto)', () => {
    nuevaBase();
    const t = registrar(construirPagoTarjeta({ tarjeta: C.nu, origen: C.bbva, monto: 200000 }));
    expect(t.tipo).toBe('pago_tarjeta');
    expect(asientos(t)).toEqual([
      [C.nu, 200000],
      [C.bbva, -200000],
    ]);
  });

  it('4 · "Saqué 500 del cajero" → retiro_efectivo', () => {
    nuevaBase();
    const t = registrar(construirRetiroEfectivo({ efectivo: C.efectivo, origen: C.bbva, monto: 50000 }));
    expect(t.tipo).toBe('retiro_efectivo');
    expect(asientos(t)).toEqual([
      [C.efectivo, 50000],
      [C.bbva, -50000],
    ]);
  });

  it('5 · "Me cayó la quincena, 8,000" a BBVA → ingreso', () => {
    nuevaBase();
    const t = registrar(construirIngreso({ destino: C.bbva, categoria: C.sueldo, monto: 800000 }));
    expect(t.tipo).toBe('ingreso');
    expect(asientos(t)).toEqual([
      [C.bbva, 800000],
      [C.sueldo, -800000],
    ]);
  });

  it('6a · "Tele de 12,000 a 12 MSI con la Oro" → compra_msi', () => {
    nuevaBase();
    const t = registrar(construirCompraMsi({ categoria: C.hogar, cuentaMsi: C.oroMsi, monto: 1200000 }));
    expect(t.tipo).toBe('compra_msi');
    expect(asientos(t)).toEqual([
      [C.hogar, 1200000],
      [C.oroMsi, -1200000],
    ]);
  });

  it('6b · corte k del plan → reclasificacion_msi con clave msi:{plan}:{k}', () => {
    nuevaBase();
    registrar(construirCompraMsi({ categoria: C.hogar, cuentaMsi: C.oroMsi, monto: 1200000 }));
    const t = registrar(
      construirReclasificacionMsi({
        planId: 'plan1',
        k: 1,
        cuentaMsi: C.oroMsi,
        tarjeta: C.oro,
        cuota: 100000,
      }),
      { origen: 'sistema' },
    );
    expect(t.tipo).toBe('reclasificacion_msi');
    expect(t.claveIdempotencia).toBe('msi:plan1:1');
    expect(asientos(t)).toEqual([
      [C.oroMsi, 100000],
      [C.oro, -100000],
    ]);
    // La misma cuota no se reclasifica dos veces.
    const otra = base.libro.registrar(
      nueva(
        construirReclasificacionMsi({
          planId: 'plan1',
          k: 1,
          cuentaMsi: C.oroMsi,
          tarjeta: C.oro,
          cuota: 100000,
        }),
      ),
    );
    expect(otra.nueva).toBe(false);
    expect(saldo(C.oroMsi)).toBe(-1100000);
  });

  it('6c · onboarding "me faltan 7 mensualidades de 1,000" → saldo_inicial (no es gasto)', () => {
    nuevaBase();
    const t = registrar(
      construirMsiExistente({
        cuentaMsi: C.oroMsi,
        capital: C.saldosIniciales,
        mensualidad: 100000,
        restantes: 7,
      }),
    );
    expect(t.tipo).toBe('saldo_inicial');
    expect(asientos(t)).toEqual([
      [C.saldosIniciales, 700000],
      [C.oroMsi, -700000],
    ]);
  });

  it('6d · "ese cargo de 12,000 fue a 12 meses" → reversa + compra_msi con la misma fecha', () => {
    nuevaBase();
    const cargo = registrar(construirGasto({ categoria: C.hogar, pago: C.oro, monto: 1200000 }), {
      fecha: '2026-10-03',
    });
    expect(asientos(cargo)).toEqual([
      [C.hogar, 1200000],
      [C.oro, -1200000],
    ]);
    const { reversa, nueva: msi } = reemplazar(
      cargo.id,
      construirCompraMsi({ categoria: C.hogar, cuentaMsi: C.oroMsi, monto: 1200000 }),
      { fecha: cargo.fecha },
    );
    expect(reversa.tipo).toBe('reversa');
    expect(reversa.revierteA).toBe(cargo.id);
    expect(reversa.fecha).toBe('2026-10-03');
    expect(asientos(reversa)).toEqual([
      [C.hogar, -1200000],
      [C.oro, 1200000],
    ]);
    expect(msi.tipo).toBe('compra_msi');
    expect(msi.reemplazaA).toBe(cargo.id);
    expect(msi.fecha).toBe('2026-10-03');
    expect(asientos(msi)).toEqual([
      [C.hogar, 1200000],
      [C.oroMsi, -1200000],
    ]);
    expect([saldo(C.oro), saldo(C.oroMsi), saldo(C.hogar)]).toEqual([0, -1200000, 1200000]);
  });

  it('6e · liquidar el plan por adelantado → liquidacion_msi', () => {
    nuevaBase();
    registrar(construirCompraMsi({ categoria: C.hogar, cuentaMsi: C.oroMsi, monto: 500000 }));
    const t = registrar(construirLiquidacionMsi({ cuentaMsi: C.oroMsi, tarjeta: C.oro, monto: 500000 }));
    expect(t.tipo).toBe('liquidacion_msi');
    expect(asientos(t)).toEqual([
      [C.oroMsi, 500000],
      [C.oro, -500000],
    ]);
    expect(saldo(C.oroMsi)).toBe(0);
  });

  it('7a · "Le presté 500 a Juan" (efectivo) → prestamo_otorgado', () => {
    nuevaBase();
    const t = registrar(construirPrestamoOtorgado({ persona: C.juan, origen: C.efectivo, monto: 50000 }));
    expect(t.tipo).toBe('prestamo_otorgado');
    expect(asientos(t)).toEqual([
      [C.juan, 50000],
      [C.efectivo, -50000],
    ]);
  });

  it('7b · "Juan me regresó 300" a BBVA → cobro_prestamo (no es ingreso)', () => {
    nuevaBase();
    const t = registrar(construirCobroPrestamo({ persona: C.juan, destino: C.bbva, monto: 30000 }));
    expect(t.tipo).toBe('cobro_prestamo');
    expect(asientos(t)).toEqual([
      [C.bbva, 30000],
      [C.juan, -30000],
    ]);
  });

  it('7c · "Mi hermano me prestó 1,000" a BBVA → prestamo_recibido', () => {
    nuevaBase();
    const t = registrar(construirPrestamoRecibido({ persona: C.hermano, destino: C.bbva, monto: 100000 }));
    expect(t.tipo).toBe('prestamo_recibido');
    expect(asientos(t)).toEqual([
      [C.bbva, 100000],
      [C.hermano, -100000],
    ]);
  });

  it('7d · "Le pagué 1,000 a mi hermano" → pago_prestamo', () => {
    nuevaBase();
    const t = registrar(construirPagoPrestamo({ persona: C.hermano, origen: C.bbva, monto: 100000 }));
    expect(t.tipo).toBe('pago_prestamo');
    expect(asientos(t)).toEqual([
      [C.hermano, 100000],
      [C.bbva, -100000],
    ]);
  });

  it('8 · "Cena de 1,200 entre 4 con la Nu" → cuenta_dividida', () => {
    nuevaBase();
    const t = registrar(
      construirCuentaDividida({
        categoria: C.comidaFuera,
        personas: [C.amigo1, C.amigo2, C.amigo3],
        pago: C.nu,
        total: 120000,
      }),
    );
    expect(t.tipo).toBe('cuenta_dividida');
    expect(asientos(t)).toEqual([
      [C.comidaFuera, 30000],
      [C.amigo1, 30000],
      [C.amigo2, 30000],
      [C.amigo3, 30000],
      [C.nu, -120000],
    ]);
  });

  it('9 · aportar / cobrar tanda desde BBVA → aportacion_tanda / cobro_tanda', () => {
    nuevaBase();
    const aporta = registrar(construirAportacionTanda({ tanda: C.tanda, origen: C.bbva, monto: 50000 }));
    expect(aporta.tipo).toBe('aportacion_tanda');
    expect(asientos(aporta)).toEqual([
      [C.tanda, 50000],
      [C.bbva, -50000],
    ]);
    const cobra = registrar(construirCobroTanda({ tanda: C.tanda, destino: C.bbva, monto: 500000 }));
    expect(cobra.tipo).toBe('cobro_tanda');
    expect(asientos(cobra)).toEqual([
      [C.bbva, 500000],
      [C.tanda, -500000],
    ]);
  });

  it('10 · arqueo con hueco de $340 (E7-02) → ajuste_arqueo estimado', () => {
    nuevaBase();
    const t = registrar(
      construirAjusteArqueo({
        efectivo: C.efectivo,
        propuestas: [
          { cuentaId: C.comidaFuera, monto: 19429 },
          { cuentaId: C.antojos, monto: 8095 },
          { cuentaId: C.transporte, monto: 4857 },
          { cuentaId: C.variosEfectivo, monto: 1619 },
        ],
      }),
      { origen: 'arqueo' },
    );
    expect(t.tipo).toBe('ajuste_arqueo');
    expect(t.estimada).toBe(true);
    expect(asientos(t)).toEqual([
      [C.comidaFuera, 19429],
      [C.antojos, 8095],
      [C.transporte, 4857],
      [C.variosEfectivo, 1619],
      [C.efectivo, -34000],
    ]);
  });

  it('11 · saldo inicial de BBVA 3,590 → saldo_inicial', () => {
    nuevaBase();
    const t = registrar(construirSaldoInicial({ cuenta: C.bbva, capital: C.saldosIniciales, saldo: 359000 }));
    expect(t.tipo).toBe('saldo_inicial');
    expect(asientos(t)).toEqual([
      [C.bbva, 359000],
      [C.saldosIniciales, -359000],
    ]);
  });

  it('12 · "Saqué 300 con la Oro en el cajero" → retiro_efectivo contra tarjeta', () => {
    nuevaBase();
    const t = registrar(construirRetiroEfectivo({ efectivo: C.efectivo, origen: C.oro, monto: 30000 }));
    expect(t.tipo).toBe('retiro_efectivo');
    expect(asientos(t)).toEqual([
      [C.efectivo, 30000],
      [C.oro, -30000],
    ]);
  });

  describe('13 · gasto sin método: "coca de 25" → por_asignar, y su resolución', () => {
    const puente = () => {
      nuevaBase();
      const t = registrar(construirGasto({ categoria: C.antojos, pago: C.porAsignar, monto: 2500 }), {
        descripcion: 'coca',
        origen: 'voz',
      });
      expect(t.tipo).toBe('gasto');
      expect(asientos(t)).toEqual([
        [C.antojos, 2500],
        [C.porAsignar, -2500],
      ]);
      return t;
    };

    it('se registra contra pasivo:por_asignar', () => {
      puente();
    });

    it('se resuelve con la notificación de la Nu (E9-38): reemplazo con la cuenta real', () => {
      const t = puente();
      const { reversa, nueva: real } = reemplazar(
        t.id,
        construirGasto({ categoria: C.antojos, pago: C.nu, monto: 2500 }),
        { descripcion: 'coca', origen: 'notificacion' },
      );
      expect(asientos(reversa)).toEqual([
        [C.antojos, -2500],
        [C.porAsignar, 2500],
      ]);
      expect(asientos(real)).toEqual([
        [C.antojos, 2500],
        [C.nu, -2500],
      ]);
      expect(real.reemplazaA).toBe(t.id);
      expect([saldo(C.porAsignar), saldo(C.nu), saldo(C.antojos)]).toEqual([0, -2500, 2500]);
    });

    it('se resuelve marcándolo en el arqueo como efectivo (E7-08)', () => {
      const t = puente();
      const { nueva: real } = reemplazar(
        t.id,
        construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 2500 }),
        {
          origen: 'arqueo',
        },
      );
      expect(asientos(real)).toEqual([
        [C.antojos, 2500],
        [C.efectivo, -2500],
      ]);
      expect(saldo(C.porAsignar)).toBe(0);
    });
  });

  it('14 · anular #1 → reversa espejo con revierte_a', () => {
    nuevaBase();
    const t1 = registrar(construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 2500 }));
    const r = base.libro.anular(t1.id);
    expect(r.tipo).toBe('reversa');
    expect(r.revierteA).toBe(t1.id);
    expect(asientos(r)).toEqual([
      [C.antojos, -2500],
      [C.efectivo, 2500],
    ]);
    expect([saldo(C.antojos), saldo(C.efectivo)]).toEqual([0, 0]);
  });

  const caso15 = () =>
    registrar(construirSalidaPendiente({ origen: C.bbva, transito: C.transito, monto: 420000 }), {
      origen: 'notificacion',
    });
  const caso17 = () =>
    registrar(construirPagoRecibidoPendiente({ tarjeta: C.t8812, transito: C.transito, monto: 420000 }), {
      origen: 'notificacion',
    });

  it('15 · "Enviaste $4,200" desde BBVA sin pareja → transferencia_pendiente', () => {
    nuevaBase();
    const t = caso15();
    expect(t.tipo).toBe('transferencia_pendiente');
    expect(asientos(t)).toEqual([
      [C.transito, 420000],
      [C.bbva, -420000],
    ]);
  });

  it('16 · llega "Recibimos tu pago de $4,200" en la 8812 → reemplaza #15 por pago_tarjeta', () => {
    nuevaBase();
    const t15 = caso15();
    const { reversa, nueva: pago } = reemplazar(
      t15.id,
      construirPagoTarjeta({ tarjeta: C.t8812, origen: C.bbva, monto: 420000 }),
      { origen: 'notificacion' },
    );
    expect(reversa.revierteA).toBe(t15.id);
    expect(pago.tipo).toBe('pago_tarjeta');
    expect(asientos(pago)).toEqual([
      [C.t8812, 420000],
      [C.bbva, -420000],
    ]);
    expect([saldo(C.transito), saldo(C.bbva), saldo(C.t8812)]).toEqual([0, -420000, 420000]);
  });

  it('17 · "Recibimos tu pago" llega primero → transferencia_pendiente contra tránsito', () => {
    nuevaBase();
    const t = caso17();
    expect(t.tipo).toBe('transferencia_pendiente');
    expect(asientos(t)).toEqual([
      [C.t8812, 420000],
      [C.transito, -420000],
    ]);
  });

  describe('18 · #15 sin pareja en 24 h: reemplazo según la respuesta', () => {
    const variantes: [string, () => MovimientoPropuesto, string, [string, number][]][] = [
      [
        'A otra cuenta mía que no llevo aquí',
        () => construirTransferencia({ origen: C.bbva, destino: C.cuentasExternas, monto: 420000 }),
        'transferencia',
        [
          [C.cuentasExternas, 420000],
          [C.bbva, -420000],
        ],
      ],
      [
        'Le presté a Caro',
        () => construirPrestamoOtorgado({ persona: C.caro, origen: C.bbva, monto: 420000 }),
        'prestamo_otorgado',
        [
          [C.caro, 420000],
          [C.bbva, -420000],
        ],
      ],
      [
        'Pagué algo',
        () => construirGasto({ categoria: C.hogar, pago: C.bbva, monto: 420000 }),
        'gasto',
        [
          [C.hogar, 420000],
          [C.bbva, -420000],
        ],
      ],
    ];
    for (const [respuesta, mov, tipo, esperados] of variantes) {
      it(respuesta, () => {
        nuevaBase();
        const t15 = caso15();
        const { nueva: t } = reemplazar(t15.id, mov());
        expect(t.tipo).toBe(tipo);
        expect(t.reemplazaA).toBe(t15.id);
        expect(asientos(t)).toEqual(esperados);
        expect(saldo(C.transito)).toBe(0);
      });
    }
  });

  describe('19 · #17 sin pareja en 24 h: reemplazo según la respuesta', () => {
    const variantes: [string, () => MovimientoPropuesto, string, [string, number][]][] = [
      [
        'De una de mis cuentas (BBVA)',
        () => construirPagoTarjeta({ tarjeta: C.t8812, origen: C.bbva, monto: 420000 }),
        'pago_tarjeta',
        [
          [C.t8812, 420000],
          [C.bbva, -420000],
        ],
      ],
      [
        'De una cuenta que no llevo aquí',
        () => construirPagoTarjeta({ tarjeta: C.t8812, origen: C.cuentasExternas, monto: 420000 }),
        'pago_tarjeta',
        [
          [C.t8812, 420000],
          [C.cuentasExternas, -420000],
        ],
      ],
      [
        'Alguien más la pagó (le debes)',
        () => construirPrestamoRecibido({ persona: C.hermano, destino: C.t8812, monto: 420000 }),
        'prestamo_recibido',
        [
          [C.t8812, 420000],
          [C.hermano, -420000],
        ],
      ],
      [
        'Alguien más la pagó (regalo)',
        () => construirIngreso({ destino: C.t8812, categoria: C.regaloRecibido, monto: 420000 }),
        'ingreso',
        [
          [C.t8812, 420000],
          [C.regaloRecibido, -420000],
        ],
      ],
    ];
    for (const [respuesta, mov, tipo, esperados] of variantes) {
      it(respuesta, () => {
        nuevaBase();
        const t17 = caso17();
        const { nueva: t } = reemplazar(t17.id, mov());
        expect(t.tipo).toBe(tipo);
        expect(t.reemplazaA).toBe(t17.id);
        expect(asientos(t)).toEqual(esperados);
        expect(saldo(C.transito)).toBe(0);
      });
    }
  });

  it('20 · "Me pagaron 2,000 de un trabajo" sin destino → por_asignar_entradas; al llegar el depósito se reemplaza', () => {
    nuevaBase();
    const t = registrar(
      construirIngreso({ destino: C.porAsignarEntradas, categoria: C.honorarios, monto: 200000 }),
    );
    expect(t.tipo).toBe('ingreso');
    expect(asientos(t)).toEqual([
      [C.porAsignarEntradas, 200000],
      [C.honorarios, -200000],
    ]);
    const { nueva: real } = reemplazar(
      t.id,
      construirIngreso({ destino: C.bbva, categoria: C.honorarios, monto: 200000 }),
      { origen: 'notificacion' },
    );
    expect(asientos(real)).toEqual([
      [C.bbva, 200000],
      [C.honorarios, -200000],
    ]);
    expect([saldo(C.porAsignarEntradas), saldo(C.bbva), saldo(C.honorarios)]).toEqual([0, 200000, -200000]);
  });

  it('21 · devolución de 300 en la Oro de una compra de ropa → reembolso', () => {
    nuevaBase();
    const t = registrar(construirReembolso({ destino: C.oro, contra: C.ropa, monto: 30000 }));
    expect(t.tipo).toBe('reembolso');
    expect(asientos(t)).toEqual([
      [C.oro, 30000],
      [C.ropa, -30000],
    ]);
  });

  it('21 · variante sin cargo original → contra ingreso:reembolso', () => {
    nuevaBase();
    const t = registrar(construirReembolso({ destino: C.oro, contra: C.ingresoReembolso, monto: 30000 }));
    expect(t.tipo).toBe('reembolso');
    expect(asientos(t)).toEqual([
      [C.oro, 30000],
      [C.ingresoReembolso, -30000],
    ]);
  });

  it('22 · "En BBVA tengo 4,200" y el libro dice 4,350 → conciliacion', () => {
    nuevaBase();
    registrar(construirSaldoInicial({ cuenta: C.bbva, capital: C.saldosIniciales, saldo: 435000 }));
    const t = registrar(
      construirConciliacion({
        cuenta: C.bbva,
        capital: C.ajusteConciliacion,
        saldoLibro: saldo(C.bbva),
        saldoReal: 420000,
      }),
    );
    expect(t.tipo).toBe('conciliacion');
    expect(asientos(t)).toEqual([
      [C.ajusteConciliacion, 15000],
      [C.bbva, -15000],
    ]);
    expect(saldo(C.bbva)).toBe(420000);
  });

  it('23 · "di mi tanda de 500" / "me tocó la tanda, 5 mil" en efectivo (ni gasto ni ingreso)', () => {
    nuevaBase();
    const aporta = registrar(construirAportacionTanda({ tanda: C.tanda, origen: C.efectivo, monto: 50000 }));
    expect(aporta.tipo).toBe('aportacion_tanda');
    expect(asientos(aporta)).toEqual([
      [C.tanda, 50000],
      [C.efectivo, -50000],
    ]);
    const cobra = registrar(construirCobroTanda({ tanda: C.tanda, destino: C.efectivo, monto: 500000 }));
    expect(cobra.tipo).toBe('cobro_tanda');
    expect(asientos(cobra)).toEqual([
      [C.efectivo, 500000],
      [C.tanda, -500000],
    ]);
  });

  it('23b · tanda que ya existía (E11-03: 6 aportaciones hechas, ya cobró) → saldo_inicial', () => {
    nuevaBase();
    const t = registrar(
      construirSaldoInicial({ cuenta: C.tanda, capital: C.saldosIniciales, saldo: -200000 }),
    );
    expect(t.tipo).toBe('saldo_inicial');
    expect(asientos(t)).toEqual([
      [C.saldosIniciales, 200000],
      [C.tanda, -200000],
    ]);
  });
});

describe('CA-M1-04 · rechazos de registrar', () => {
  function codigo(f: () => unknown): string | undefined {
    try {
      f();
    } catch (e) {
      if (e instanceof ErrorDominio) return e.codigo;
      throw e;
    }
    return undefined;
  }
  const cuantas = () =>
    (base.cliente.prepare('SELECT COUNT(*) AS n FROM transaccion').get() as { n: number }).n +
    (base.cliente.prepare('SELECT COUNT(*) AS n FROM asiento').get() as { n: number }).n;

  const malos: [string, MovimientoPropuesto, string][] = [
    [
      'pago_tarjeta con patrón de gasto',
      { ...construirGasto({ categoria: C.comidaFuera, pago: C.bbva, monto: 100 }), tipo: 'pago_tarjeta' },
      'patron_invalido',
    ],
    [
      'gasto con patrón de pago de tarjeta',
      { ...construirPagoTarjeta({ tarjeta: C.nu, origen: C.bbva, monto: 100 }), tipo: 'gasto' },
      'patron_invalido',
    ],
    [
      'ingreso con patrón de cobro de préstamo',
      { ...construirCobroPrestamo({ persona: C.juan, destino: C.bbva, monto: 100 }), tipo: 'ingreso' },
      'patron_invalido',
    ],
    [
      'transferencia entre BBVA y tránsito',
      construirTransferencia({ origen: C.bbva, destino: C.transito, monto: 100 }),
      'patron_invalido',
    ],
    [
      'reclasificación MSI contra una tarjeta que no es la madre',
      construirReclasificacionMsi({ planId: 'p', k: 1, cuentaMsi: C.oroMsi, tarjeta: C.nu, cuota: 100 }),
      'patron_invalido',
    ],
    [
      'ajuste de arqueo sin estimada',
      {
        tipo: 'ajuste_arqueo',
        asientos: [
          { cuentaId: C.antojos, monto: 100 },
          { cuentaId: C.efectivo, monto: -100 },
        ],
      },
      'patron_invalido',
    ],
    [
      'una reversa registrada a mano',
      {
        tipo: 'reversa',
        asientos: [
          { cuentaId: C.antojos, monto: -100 },
          { cuentaId: C.efectivo, monto: 100 },
        ],
      },
      'patron_invalido',
    ],
    [
      'gasto con una cuenta archivada',
      construirGasto({ categoria: C.antojos, pago: C.archivada, monto: 100 }),
      'cuenta_archivada',
    ],
    [
      'gasto con una cuenta inexistente',
      construirGasto({ categoria: C.antojos, pago: 'no-existe', monto: 100 }),
      'cuenta_inexistente',
    ],
    [
      'asientos que no suman cero',
      {
        tipo: 'gasto',
        asientos: [
          { cuentaId: C.antojos, monto: 100 },
          { cuentaId: C.efectivo, monto: -99 },
        ],
      },
      'suma_distinta_de_cero',
    ],
  ];
  for (const [nombre, mov, esperado] of malos) {
    it(`rechaza ${nombre} sin escribir nada`, () => {
      nuevaBase();
      const antes = cuantas();
      expect(codigo(() => base.libro.registrar(nueva(mov)))).toBe(esperado);
      expect(cuantas()).toBe(antes);
    });
  }

  it('rechaza un tipo fuera de la lista y un origen inválido', () => {
    nuevaBase();
    const m = construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 100 });
    expect(codigo(() => base.libro.registrar({ ...nueva(m), tipo: 'regalo' as 'gasto' }))).toBe(
      'tipo_invalido',
    );
    expect(codigo(() => base.libro.registrar({ ...nueva(m), origen: 'radio' as 'voz' }))).toBe(
      'origen_invalido',
    );
  });

  it('reemplazar es atómico: si la nueva es inválida, la original no queda anulada', () => {
    nuevaBase();
    const t = registrar(construirGasto({ categoria: C.antojos, pago: C.porAsignar, monto: 2500 }));
    const antes = cuantas();
    expect(
      codigo(() =>
        base.libro.reemplazar(
          t.id,
          nueva(construirGasto({ categoria: C.antojos, pago: C.archivada, monto: 2500 })),
        ),
      ),
    ).toBe('cuenta_archivada');
    expect(cuantas()).toBe(antes);
    expect(base.libro.anular(t.id).revierteA).toBe(t.id);
  });

  it('reemplazar con la misma clave devuelve el par existente', () => {
    nuevaBase();
    const t = registrar(construirGasto({ categoria: C.antojos, pago: C.porAsignar, monto: 2500 }));
    const nuevaTx = nueva(construirGasto({ categoria: C.antojos, pago: C.nu, monto: 2500 }));
    const a = base.libro.reemplazar(t.id, nuevaTx);
    const b = base.libro.reemplazar(t.id, nuevaTx);
    expect(b).toEqual(a);
    expect(codigo(() => base.libro.reemplazar('otra', nuevaTx))).toBe('clave_duplicada');
  });

  it('anular una transacción inexistente', () => {
    nuevaBase();
    expect(codigo(() => base.libro.anular('nada'))).toBe('transaccion_inexistente');
  });
});
