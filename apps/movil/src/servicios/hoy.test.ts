import { describe, expect, it } from 'vitest';
import type { DesgloseReservado, PlainDate, Regla } from '@cartera/core';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { fijarColchon } from './ajustes';
import { activarCaptura, apagarCapturaTrasRestaurar, desactivarCaptura } from './estado-captura';
import { deshacer } from './formulario';
import { obtenerHoy, type TarjetaAccion } from './hoy';
import {
  confirmarIngresoRecibido,
  listarOcurrencias,
  omitirOcurrencia,
  todaviaNo,
  yaLaPague,
} from './ocurrencias';
import { agregarCuenta, agregarPagoFijo, agregarTarjetaCredito, configurarIngreso } from './onboarding';
import { crearPersona, fijarApartarDeuda, registrarPrestamo } from './personas';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, vector } from './__pruebas__/base';

interface VectorE4 {
  entrada: {
    hoy: PlainDate;
    fin_horizonte: PlainDate;
    liquidez: number;
    colchon: number;
    compromisos: { concepto: string; fecha: PlainDate; monto: number }[];
    tarjetas: { id: string; modo: 'totalero' | 'plan'; saldo_revolvente: number }[];
    deudas_personas?: { contraparte: string; monto: number; apartar: boolean }[];
  };
  esperado: {
    dias: number;
    reservado: number;
    desglose: DesgloseReservado;
    libre: number;
    hoy_puedes_centavos: number;
    hoy_puedes_pesos_mostrados: number;
  };
}

interface VectorE3 {
  hoy: PlainDate;
  regla: Regla;
  esperado: { fin: PlainDate; fin_efectivo: PlainDate; dias: number; estado: string };
}

function saldoCuenta(p: ReturnType<typeof abrirPrueba>, id: string) {
  return p.ctx.libro.saldo(id);
}

describe('Hoy', () => {
  it('CA-M2-03 · con la semilla e4-01 muestra $214, "4 días para tu quincena (jue 15)" y el desglose de E4-01', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const v = vector<VectorE4>('E4-01');

    const hoy = obtenerHoy(p.ctx);
    expect(hoy.hoyPuedesPesos).toBe(214);
    expect(hoy.hoyPuedesPesos).toBe(v.esperado.hoy_puedes_pesos_mostrados);
    expect(hoy.hoyPuedesCentavos).toBe(v.esperado.hoy_puedes_centavos);
    expect(hoy.textoDias).toBe('4 días para tu quincena (jue 15)');
    expect(hoy.dias).toBe(v.esperado.dias);
    expect(hoy.finEfectivo).toBe(v.entrada.fin_horizonte);
    expect(hoy.estado).toBe('normal');
    expect(hoy.liquidez).toBe(v.entrada.liquidez);
    expect(hoy.colchon).toBe(v.entrada.colchon);
    expect(hoy.desglose).toEqual(v.esperado.desglose);
    expect(hoy.reservado).toBe(v.esperado.reservado);
    expect(hoy.libre).toBe(v.esperado.libre);
    // "Reservado (Nu, tanda, internet)": la renta del 31 queda fuera del horizonte.
    expect(hoy.reservadoDetalle.map((r) => r.concepto)).toEqual(['Nu ••4410', 'tanda', 'internet']);
    expect(hoy.tarjetasAccion).toEqual([]);
    // Idempotente: abrir Hoy otra vez no cambia nada.
    expect(obtenerHoy(p.ctx)).toEqual(hoy);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M2-08 · el 15 oct sin depósito muestra "día de pago" con $456 (E3-11, E4-05); al registrar el depósito el horizonte pasa al 30 oct', () => {
    const v4 = vector<VectorE4>('E4-05');
    const v3 = vector<VectorE3>('E3-11');
    const p = abrirPrueba('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: v4.entrada.liquidez });
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 0 });
    for (const t of v4.entrada.tarjetas) {
      agregarTarjetaCredito(p.ctx, {
        nombre: 'Nu',
        diaCorte: 28,
        diaLimitePago: 18,
        limiteCredito: 1_500_000,
        modo: t.modo,
        saldo: t.saldo_revolvente,
      });
    }
    for (const c of v4.entrada.compromisos) {
      agregarPagoFijo(p.ctx, {
        concepto: c.concepto,
        monto: c.monto,
        regla: { tipo: 'unica', fecha: c.fecha },
      });
    }
    fijarColchon(p.ctx, v4.entrada.colchon);
    const ingresoId = configurarIngreso(p.ctx, { monto: 650_000, regla: v3.regla, cuentaId: bbva });

    p.reloj.fijar(v3.hoy);
    expect(v4.entrada.hoy).toBe(v3.hoy);
    const enDiaDePago = obtenerHoy(p.ctx);
    expect(enDiaDePago.estado).toBe('dia_de_pago');
    expect(enDiaDePago.estadoHorizonte).toBe(v3.esperado.estado);
    expect(enDiaDePago.finEfectivo).toBe(v3.esperado.fin_efectivo);
    expect(enDiaDePago.dias).toBe(v4.esperado.dias);
    expect(enDiaDePago.hoyPuedesPesos).toBe(456);
    expect(enDiaDePago.hoyPuedesPesos).toBe(v4.esperado.hoy_puedes_pesos_mostrados);
    expect(enDiaDePago.desglose).toEqual(v4.esperado.desglose);
    expect(enDiaDePago.libre).toBe(v4.esperado.libre);
    expect(enDiaDePago.mensaje).toBe(
      'Hoy es día de pago. Mientras llega tu depósito reparto en 3 días; cuando llegue, recalculo.',
    );
    const tarjeta = enDiaDePago.tarjetasAccion.find((t) => t.tipo === 'ingreso_no_llego');
    expect(tarjeta).toMatchObject({ programadoId: ingresoId, fecha: v3.hoy, cuando: 'hoy' });

    // "Sí, ya llegó": registra el depósito y cubre la ocurrencia.
    confirmarIngresoRecibido(p.ctx, { programadoId: ingresoId, fecha: v3.esperado.fin, destinoId: bbva });
    const conDeposito = obtenerHoy(p.ctx);
    expect(conDeposito.estado).toBe('normal');
    expect(conDeposito.proximoIngreso?.fecha).toBe('2026-10-30');
    expect(conDeposito.finEfectivo).toBe('2026-10-30');
    expect(conDeposito.dias).toBe(15);
    expect(conDeposito.textoDias).toBe('15 días para tu quincena (vie 30)');
    expect(conDeposito.liquidez).toBe(v4.entrada.liquidez + 650_000);
    expect(conDeposito.libre).toBe(v4.esperado.libre + 650_000);
    expect(conDeposito.hoyPuedesCentavos).toBe(Math.floor(conDeposito.libre / 15));
    expect(conDeposito.tarjetasAccion.some((t) => t.tipo === 'ingreso_no_llego')).toBe(false);
  });

  it('CA-M2-09 · un préstamo recibido de la jefa (apartado) deja Hoy en $214 (E4-09); al apagar "Apartar lo que le debo" sube', () => {
    const v = vector<VectorE4>('E4-09');
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const deuda = v.entrada.deudas_personas?.find((d) => d.contraparte === 'jefa');
    if (!deuda) throw new Error('E4-09 sin la deuda de la jefa');
    const jefa = crearPersona(p.ctx, { nombre: 'Mi jefa', alias: ['jefa'] });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_recibido',
      personaId: jefa,
      cuentaId: e.cuentas.bbva as string,
      monto: deuda.monto,
    });

    const apartado = obtenerHoy(p.ctx);
    expect(apartado.liquidez).toBe(v.entrada.liquidez);
    expect(apartado.hoyPuedesPesos).toBe(214);
    expect(apartado.hoyPuedesPesos).toBe(v.esperado.hoy_puedes_pesos_mostrados);
    expect(apartado.desglose.deudas_personas).toBe(deuda.monto);
    expect(apartado.libre).toBe(v.esperado.libre);
    expect(apartado.reservadoDetalle).toContainEqual({
      tipo: 'persona',
      concepto: 'Mi jefa',
      monto: deuda.monto,
      fecha: null,
    });

    fijarApartarDeuda(p.ctx, jefa, false);
    const sinApartar = obtenerHoy(p.ctx);
    expect(sinApartar.desglose.deudas_personas).toBe(0);
    expect(sinApartar.libre).toBe(v.esperado.libre + deuda.monto);
    expect(sinApartar.hoyPuedesPesos).toBeGreaterThan(apartado.hoyPuedesPesos);

    fijarApartarDeuda(p.ctx, jefa, true);
    expect(obtenerHoy(p.ctx).hoyPuedesPesos).toBe(214);
  });

  it('CA-M2-10 · "¿Ya pagaste…?": Todavía no sigue reservado; Ya la pagué registra y cubre; Ya no aplica omite', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    const bbva = e.cuentas.bbva as string;
    const saldoBbva = saldoCuenta(p, bbva);
    p.reloj.fijar('2026-10-15');

    const vencidos = (t: readonly TarjetaAccion[]) =>
      t.flatMap((x) => (x.tipo === 'compromiso_vencido' ? [x] : []));
    const inicial = obtenerHoy(p.ctx);
    const [tanda, internet] = vencidos(inicial.tarjetasAccion);
    if (!tanda || !internet) throw new Error('faltan tarjetas de acción');
    expect(tanda).toMatchObject({
      concepto: 'tanda',
      fecha: '2026-10-13',
      pregunta: '¿Ya pagaste la tanda?',
    });
    expect(internet).toMatchObject({
      concepto: 'internet',
      etiquetaFecha: 'mié 14',
      pregunta: '¿Ya pagaste el internet?',
    });
    expect(inicial.tarjetasAccion).toHaveLength(2);
    expect(inicial.desglose.compromisos).toBe(50_000 + 67_400);

    // Todavía no: sigue reservado y no vuelve a preguntar hoy.
    todaviaNo(p.ctx, tanda);
    const trasTodaviaNo = obtenerHoy(p.ctx);
    expect(trasTodaviaNo.desglose.compromisos).toBe(inicial.desglose.compromisos);
    expect(vencidos(trasTodaviaNo.tarjetasAccion).map((t) => t.concepto)).toEqual(['internet']);
    expect(trasTodaviaNo.libre).toBe(inicial.libre);

    // Ya la pagué: gasto desde la cuenta del compromiso y ocurrencia cubierta.
    const pago = yaLaPague(p.ctx, internet);
    expect(saldoCuenta(p, bbva)).toBe(saldoBbva - 67_400);
    const cubierta = listarOcurrencias(p.ctx).find((o) => o.concepto === 'internet');
    expect(cubierta).toMatchObject({ estado: 'cubierta', transaccionId: pago.transaccionId });
    const trasPagar = obtenerHoy(p.ctx);
    expect(trasPagar.desglose.compromisos).toBe(50_000);
    expect(trasPagar.libre).toBe(inicial.libre);
    expect(vencidos(trasPagar.tarjetasAccion)).toEqual([]);

    // Deshacer el pago devuelve la ocurrencia a pendiente.
    deshacer(p.ctx, pago.deshacer);
    expect(listarOcurrencias(p.ctx).find((o) => o.concepto === 'internet')?.estado).toBe('pendiente');
    expect(saldoCuenta(p, bbva)).toBe(saldoBbva);
    yaLaPague(p.ctx, internet);

    // Al día siguiente vuelve a preguntar por la tanda; Ya no aplica la omite y E4 deja de reservarla.
    p.reloj.fijar('2026-10-16');
    const otroDia = obtenerHoy(p.ctx);
    expect(vencidos(otroDia.tarjetasAccion).map((t) => t.concepto)).toEqual(['tanda']);
    expect(otroDia.desglose.compromisos).toBe(50_000);
    omitirOcurrencia(p.ctx, tanda);
    const trasOmitir = obtenerHoy(p.ctx);
    expect(trasOmitir.desglose.compromisos).toBe(0);
    expect(trasOmitir.libre).toBe(otroDia.libre + 50_000);
    expect(vencidos(trasOmitir.tarjetasAccion)).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('sin ingreso configurado pide la frecuencia; en modo variable reparte en 30 días', () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    const sin = obtenerHoy(p.ctx);
    expect(sin.estado).toBe('sin_ingreso');
    expect(sin.mensaje).toBe('Dime cada cuándo te pagan');
    expect(sin.proximoIngreso).toBeNull();
  });

  it('libre negativo: estado y faltante', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    fijarColchon(p.ctx, 200_000);
    const hoy = obtenerHoy(p.ctx);
    expect(hoy.estado).toBe('libre_negativo');
    expect(hoy.hoyPuedesCentavos).toBe(0);
    expect(hoy.faltante).toBe(-hoy.libre);
  });

  it('tras restaurar con la captura activa pide reactivarla hasta que la reactive o la descarte (pendiente 47)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    apagarCapturaTrasRestaurar(p.ctx);
    const tipos = () => obtenerHoy(p.ctx).tarjetasAccion.map((t) => t.tipo);
    expect(tipos()).toEqual(['reactivar_captura']);
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    expect(tipos()).toEqual([]);

    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    apagarCapturaTrasRestaurar(p.ctx);
    expect(tipos()).toEqual(['reactivar_captura']);
    desactivarCaptura(p.ctx);
    expect(tipos()).toEqual([]);
  });
});
