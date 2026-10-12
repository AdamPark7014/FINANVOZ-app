import { describe, expect, it } from 'vitest';
import type { PlainDate } from '@cartera/core';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { colchonSugerido, completarOnboarding, fijarColchon, onboardingCompletado } from './ajustes';
import { marcarAvisoVisto } from './avisos';
import { listarCuentas } from './cuentas';
import { obtenerHoy } from './hoy';
import { listarMovimientos } from './movimientos';
import {
  agregarCuenta,
  agregarEfectivo,
  agregarPagoFijo,
  agregarTarjetaCredito,
  configurarIngreso,
  configurarIngresoVariable,
  PAGOS_FIJOS_SUGERIDOS,
  proximoPago,
} from './onboarding';
import { listarOcurrencias } from './ocurrencias';
import { cuotasMsiPendientes } from './tarjetas';
import { abrirPrueba, tarjetaFixture, vector } from './__pruebas__/base';

interface TarjetaFixture {
  nombre: string;
  modo: 'totalero' | 'plan';
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito: number;
  saldo_revolvente: number;
}
interface VectorE606 {
  mensualidad: number;
  restantes: number;
  hoy: PlainDate;
  tarjeta: string;
  esperado: {
    saldo_msi: number;
    cuotas: { n: number; monto: number; corte: PlainDate; limite: PlainDate }[];
  };
}

function tarjetaDe(t: TarjetaFixture) {
  return {
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
    limiteCredito: t.limite_credito,
    modo: t.modo,
  };
}

describe('onboarding', () => {
  it('CA-M2-12 · MSI que ya existían con "No sé": no se restan del saldo y Hoy avisa una sola vez', () => {
    const v = vector<VectorE606>('E6-06');
    const fixture = tarjetaFixture<TarjetaFixture>(v.tarjeta);
    const p = abrirPrueba(v.hoy);
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarEfectivo(p.ctx, 500_000);
    configurarIngreso(p.ctx, { monto: 650_000, regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' } });

    const oro = agregarTarjetaCredito(p.ctx, {
      nombre: 'Oro',
      ultimos4: '8812',
      ...tarjetaDe(fixture),
      saldo: fixture.saldo_revolvente,
      msiPrevios: [{ mensualidad: v.mensualidad, restantes: v.restantes }],
      saldoIncluyeMsi: 'no_se',
    });
    // No se resta: puede contar de más, nunca de menos.
    expect(oro.saldoRevolvente).toBe(fixture.saldo_revolvente);
    expect(p.ctx.libro.saldo(oro.cuentaId)).toBe(-fixture.saldo_revolvente);
    const debes = listarCuentas(p.ctx).debes.find((d) => d.id === oro.cuentaId);
    expect(debes).toMatchObject({ saldo: fixture.saldo_revolvente, meses: v.esperado.saldo_msi });
    // E6-06: las cuotas que faltan, desde el primer corte posterior al alta.
    expect(
      cuotasMsiPendientes(p.ctx).map(({ n, monto, corte, limite }) => ({ n, monto, corte, limite })),
    ).toEqual(v.esperado.cuotas);
    // No es gasto.
    expect(listarMovimientos(p.ctx)).toEqual([]);

    const hoy = obtenerHoy(p.ctx);
    expect(hoy.desglose.tarjetas_saldo_completo).toBe(fixture.saldo_revolvente);
    expect(hoy.desglose.cuotas_msi).toBe(0); // la primera cuota vence después del horizonte
    expect(hoy.avisos).toEqual([
      {
        id: expect.any(String),
        tipo: 'msi_doble',
        texto:
          'Puede que esté contando dos veces tus meses de la Oro. Compáralo con tu próximo estado de cuenta.',
      },
    ]);
    marcarAvisoVisto(p.ctx, hoy.avisos[0]?.id as string);
    expect(obtenerHoy(p.ctx).avisos).toEqual([]);

    // M4: en el corte del 10 nov la primera cuota se factura (E6.2) y pasa a la deuda revolvente, que E4
    // reserva completa; las que siguen, no facturadas, solo cuando vencen en el horizonte.
    p.reloj.fijar('2026-12-01');
    const despues = obtenerHoy(p.ctx).desglose;
    expect(despues.tarjetas_saldo_completo).toBe(fixture.saldo_revolvente + v.mensualidad);
    expect(despues.cuotas_msi).toBe(0);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('MSI con "Sí, ya lo incluye" se restan del saldo; con "No" no hay aviso', () => {
    const v = vector<VectorE606>('E6-06');
    const fixture = tarjetaFixture<TarjetaFixture>(v.tarjeta);
    const p = abrirPrueba(v.hoy);
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const total = v.mensualidad * v.restantes;
    const si = agregarTarjetaCredito(p.ctx, {
      nombre: 'Oro',
      ...tarjetaDe(fixture),
      saldo: total + fixture.saldo_revolvente,
      msiPrevios: [{ mensualidad: v.mensualidad, restantes: v.restantes }],
      saldoIncluyeMsi: 'si',
    });
    expect(si.saldoRevolvente).toBe(fixture.saldo_revolvente);
    const no = agregarTarjetaCredito(p.ctx, {
      nombre: 'Otra',
      ...tarjetaDe(fixture),
      saldo: fixture.saldo_revolvente,
      msiPrevios: [{ mensualidad: v.mensualidad, restantes: v.restantes }],
      saldoIncluyeMsi: 'no',
    });
    expect(no.saldoRevolvente).toBe(fixture.saldo_revolvente);
    expect(obtenerHoy(p.ctx).avisos).toEqual([]);
    // Sin saldo no se crea; con meses hay que contestar si el saldo los incluye.
    expect(() => agregarTarjetaCredito(p.ctx, { nombre: 'X', ...tarjetaDe(fixture) } as never)).toThrow(
      expect.objectContaining({ codigo: 'tarjeta_invalida' }),
    );
    expect(() =>
      agregarTarjetaCredito(p.ctx, {
        nombre: 'X',
        ...tarjetaDe(fixture),
        saldo: 0,
        msiPrevios: [{ mensualidad: 100, restantes: 2 }],
      }),
    ).toThrow(expect.objectContaining({ codigo: 'tarjeta_invalida' }));
  });

  it('O1–O7 completo: ingreso, cuentas, tarjeta, pagos fijos y colchón dejan Hoy listo', () => {
    const p = abrirPrueba('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const regla = { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' } as const;
    expect(proximoPago(regla, '2026-10-11')).toBe('2026-10-15');
    const bbva = agregarCuenta(p.ctx, {
      subtipo: 'debito',
      nombre: 'BBVA',
      saldo: 359_000,
      ultimos4: '5521',
    });
    configurarIngreso(p.ctx, { monto: 650_000, regla, cuentaId: bbva });
    agregarEfectivo(p.ctx, 64_000);
    agregarTarjetaCredito(p.ctx, {
      nombre: 'Nu',
      diaCorte: 28,
      diaLimitePago: 18,
      limiteCredito: 1_500_000,
      modo: 'totalero',
      saldo: 200_000,
    });
    const luz = PAGOS_FIJOS_SUGERIDOS.find((s) => s.clave === 'luz');
    agregarPagoFijo(p.ctx, {
      concepto: luz?.concepto ?? 'luz',
      monto: 41_000,
      regla: { tipo: 'mensual', dia: 14 },
      categoria: luz?.categoria ?? null,
      variable: luz?.variable ?? false,
      cuentaId: bbva,
    });
    expect(colchonSugerido(p.ctx)).toBe(65_000);
    fijarColchon(p.ctx, colchonSugerido(p.ctx));
    expect(onboardingCompletado(p.ctx)).toBe(false);
    completarOnboarding(p.ctx);
    expect(onboardingCompletado(p.ctx)).toBe(true);

    const hoy = obtenerHoy(p.ctx);
    expect(hoy.estado).toBe('normal');
    expect(hoy.liquidez).toBe(423_000);
    expect(hoy.desglose.compromisos).toBe(41_000);
    expect(hoy.proximoIngreso).toEqual({ concepto: 'quincena', fecha: '2026-10-15', etiqueta: 'jue 15' });
    // Materializa [desde, hoy + 90): luz del 14 oct, 14 nov y 14 dic.
    expect(listarOcurrencias(p.ctx, { tipo: 'egreso' }).map((o) => o.fecha)).toEqual([
      '2026-10-14',
      '2026-11-14',
      '2026-12-14',
    ]);
    const cuentas = listarCuentas(p.ctx);
    expect(cuentas.tienes.map((c) => [c.nombre, c.saldo])).toEqual([
      ['BBVA', 359_000],
      ['Efectivo', 64_000],
    ]);
    expect(cuentas.debes.map((c) => [c.nombre, c.saldo])).toEqual([['Nu', 200_000]]);
    expect(cuentas.compromisos.map((c) => c.fecha)).toEqual(['2026-10-14']);

    // "Varía": modo ingreso variable.
    configurarIngresoVariable(p.ctx);
    const variable = obtenerHoy(p.ctx);
    expect(variable.estado).toBe('ingreso_variable');
    expect(variable.dias).toBe(30);
    expect(variable.mensaje).toBe('Reparto tu dinero libre en 30 días.');
  });
});
