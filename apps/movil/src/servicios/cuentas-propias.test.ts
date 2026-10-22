import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import {
  cambiarMontoPagoFijo,
  corregirSaldoCuenta,
  detalleCuentaPropia,
  detallePagoFijo,
  listarPagosFijos,
  quitarPagoFijoActivo,
} from './cuentas-propias';
import { listarCuentas } from './cuentas';
import { agregarCuenta, agregarEfectivo, agregarPagoFijo, agregarTarjetaCredito } from './onboarding';
import { crearTanda, reglaDeFrecuencia } from './tandas';
import { abrirPrueba } from './__pruebas__/base';

function preparar() {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarEfectivo(p.ctx, 50_000);
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 435_000 });
  return { ...p, efectivo, bbva };
}

describe('detalle y corregir saldo de una cuenta de Tienes (`04 §4` caso 22)', () => {
  it('el detalle dice si se corrige escribiendo el saldo; el efectivo se cuenta', () => {
    const p = preparar();
    expect(detalleCuentaPropia(p.ctx, p.bbva)).toMatchObject({
      nombre: 'BBVA',
      subtipo: 'debito',
      saldo: 435_000,
      corregible: true,
    });
    expect(detalleCuentaPropia(p.ctx, p.efectivo)).toMatchObject({ subtipo: 'efectivo', corregible: false });
    expect(detalleCuentaPropia(p.ctx, 'no-existe')).toBeNull();
  });

  it('«En BBVA tengo 4,200» y el libro dice 4,350: conciliación de 150 sin tocar lo anterior', () => {
    const p = preparar();
    const antes = p.ctx.libro.saldo(CUENTAS_SISTEMA.ajusteConciliacion);
    const r = corregirSaldoCuenta(p.ctx, p.bbva, 420_000);
    expect(r.saldo).toBe(420_000);
    expect(r.transaccionId).not.toBeNull();
    expect(p.ctx.libro.saldo(p.bbva)).toBe(420_000);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.ajusteConciliacion) - antes).toBe(15_000);
    const t = p.ctx.libro.obtener(r.transaccionId as string);
    expect(t?.tipo).toBe('conciliacion');
    expect(t?.asientos.reduce((s, a) => s + a.monto, 0)).toBe(0);
    expect(listarCuentas(p.ctx).tienes.find((c) => c.id === p.bbva)?.saldo).toBe(420_000);
    // Hacia arriba también: sube el saldo con otra conciliación.
    corregirSaldoCuenta(p.ctx, p.bbva, 500_000);
    expect(p.ctx.libro.saldo(p.bbva)).toBe(500_000);
  });

  it('si el saldo ya coincide no registra nada', () => {
    const p = preparar();
    expect(corregirSaldoCuenta(p.ctx, p.bbva, 435_000)).toEqual({ transaccionId: null, saldo: 435_000 });
  });

  it('rechaza el efectivo, las tarjetas, montos negativos o con decimales', () => {
    const p = preparar();
    const nu = agregarTarjetaCredito(p.ctx, {
      nombre: 'Nu',
      diaCorte: 5,
      diasParaPagar: 20,
      limiteCredito: 2_000_000,
      modo: 'totalero',
      saldo: 0,
    }).cuentaId;
    expect(() => corregirSaldoCuenta(p.ctx, p.efectivo, 10_000)).toThrow(
      expect.objectContaining({ codigo: 'cuenta_invalida' }),
    );
    expect(() => corregirSaldoCuenta(p.ctx, nu, 10_000)).toThrow(
      expect.objectContaining({ codigo: 'cuenta_invalida' }),
    );
    expect(() => corregirSaldoCuenta(p.ctx, p.bbva, -1)).toThrow(
      expect.objectContaining({ codigo: 'monto_invalido' }),
    );
    expect(() => corregirSaldoCuenta(p.ctx, p.bbva, 10.5)).toThrow(
      expect.objectContaining({ codigo: 'monto_invalido' }),
    );
    expect(p.ctx.libro.saldo(p.bbva)).toBe(435_000);
  });
});

describe('pagos fijos desde Cuentas', () => {
  it('lista también los que caen lejos (anuales) con su próxima fecha y la cuenta de la que salen', () => {
    const p = preparar();
    const predial = agregarPagoFijo(p.ctx, {
      concepto: 'predial',
      monto: 300_000,
      regla: { tipo: 'anual', mes: 2, dia: 15 },
      cuentaId: p.bbva,
    });
    const renta = agregarPagoFijo(p.ctx, {
      concepto: 'renta',
      monto: 800_000,
      regla: { tipo: 'mensual', dia: 1 },
    });
    const lista = listarPagosFijos(p.ctx);
    expect(lista.map((x) => x.id)).toEqual([predial, renta]);
    expect(lista[0]).toMatchObject({
      concepto: 'predial',
      cuenta: 'BBVA',
      origen: 'pago_fijo',
      proxima: null,
      tarjetaId: null,
      tandaId: null,
    });
    expect(lista[1]).toMatchObject({ concepto: 'renta', proxima: '2026-11-01', cuenta: null });
    // Cuentas solo enseña los próximos 30 días: el predial no sale ahí, pero sí en la lista completa.
    expect(listarCuentas(p.ctx).compromisos.some((c) => c.programadoId === predial)).toBe(false);
  });

  it('Cambiar monto aparta lo nuevo desde ya; Quitar deja de apartarlo', () => {
    const p = preparar();
    const renta = agregarPagoFijo(p.ctx, {
      concepto: 'renta',
      monto: 800_000,
      regla: { tipo: 'mensual', dia: 1 },
    });
    cambiarMontoPagoFijo(p.ctx, renta, 850_000);
    expect(detallePagoFijo(p.ctx, renta)?.monto).toBe(850_000);
    expect(listarCuentas(p.ctx).compromisos.find((c) => c.programadoId === renta)?.monto).toBe(850_000);
    quitarPagoFijoActivo(p.ctx, renta);
    expect(detallePagoFijo(p.ctx, renta)).toBeNull();
    expect(listarCuentas(p.ctx).compromisos.some((c) => c.programadoId === renta)).toBe(false);
    expect(() => quitarPagoFijoActivo(p.ctx, renta)).toThrow(
      expect.objectContaining({ codigo: 'programado_inexistente' }),
    );
  });

  it('las aportaciones de una tanda se ven, pero se cambian desde la tanda', () => {
    const p = preparar();
    const { tandaId, programadoId } = crearTanda(p.ctx, {
      aportacion: 50_000,
      participantes: 4,
      turno: 2,
      regla: reglaDeFrecuencia('quincenal', '2026-10-15'),
      inicio: '2026-10-15',
      cuentaId: null,
    });
    expect(detallePagoFijo(p.ctx, programadoId)).toMatchObject({ origen: 'tanda', tandaId });
    expect(() => cambiarMontoPagoFijo(p.ctx, programadoId, 1)).toThrow(
      expect.objectContaining({ codigo: 'compromiso_no_editable' }),
    );
    expect(() => quitarPagoFijoActivo(p.ctx, programadoId)).toThrow(
      expect.objectContaining({ codigo: 'compromiso_no_editable' }),
    );
    expect(detallePagoFijo(p.ctx, programadoId)).not.toBeNull();
  });

  it('Cambiar monto rechaza cero', () => {
    const p = preparar();
    const luz = agregarPagoFijo(p.ctx, {
      concepto: 'luz',
      monto: 40_000,
      regla: { tipo: 'mensual', dia: 20 },
      variable: true,
    });
    expect(() => cambiarMontoPagoFijo(p.ctx, luz, 0)).toThrow(
      expect.objectContaining({ codigo: 'monto_invalido' }),
    );
    expect(detallePagoFijo(p.ctx, luz)).toMatchObject({ monto: 40_000, variable: true });
  });
});
