import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { fijarColchon, obtenerColchon } from './ajustes';
import { confirmarIngresoDicho, confirmarSaldoDicho } from './ajustes-dichos';
import { deshacer } from './deshacer';
import { agregarCuenta, configurarIngreso } from './onboarding';
import { ingresoPrincipal } from './programados';
import { contarPorInterpretar, registrarTexto, registrarTextoLocal } from './registrar';
import { abrirPrueba } from './__pruebas__/base';

function preparar() {
  const p = abrirPrueba();
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  return p;
}

describe('colchón e ingreso dichos (nivel 0, sin nube)', () => {
  it('«quiero tener siempre 500 de colchón» lo aplica al momento y Deshacer regresa el anterior', async () => {
    const p = preparar();
    fijarColchon(p.ctx, 20_000);
    const r = await registrarTexto(p.ctx, 'quiero tener siempre 500 de colchón', 'voz');
    expect(r).toEqual({
      resultado: 'colchon_configurado',
      monto: 50_000,
      anterior: 20_000,
      deshacer: 'k:20000',
    });
    expect(obtenerColchon(p.ctx)).toBe(50_000);
    expect(contarPorInterpretar(p.ctx)).toBe(0);
    deshacer(p.ctx, 'k:20000');
    expect(obtenerColchon(p.ctx)).toBe(20_000);
  });

  it('«me pagan 8 mil cada quincena, el 15 y el último» no cambia nada hasta confirmar', () => {
    const p = preparar();
    configurarIngreso(p.ctx, { concepto: 'sueldo', monto: 1_000_000, regla: { tipo: 'mensual', dia: 30 } });
    const r = registrarTextoLocal(p.ctx, 'me pagan 8 mil cada quincena, el 15 y el último', 'voz');
    if (r?.resultado !== 'ingreso_por_confirmar') throw new Error(`llegó ${r?.resultado}`);
    expect(r.propuesta).toMatchObject({
      monto: 800_000,
      regla: { tipo: 'quincenal_15_ultimo' },
      anterior: { monto: 1_000_000, regla: { tipo: 'mensual', dia: 30 } },
    });
    expect(r.propuesta.proximo).not.toBeNull();
    expect(ingresoPrincipal(p.ctx)?.monto).toBe(1_000_000);
    confirmarIngresoDicho(p.ctx, r.propuesta);
    expect(ingresoPrincipal(p.ctx)).toMatchObject({
      monto: 800_000,
      concepto: 'quincena',
      regla: { tipo: 'quincenal_15_ultimo' },
    });
  });

  it('sin ingreso previo la propuesta no trae «anterior»', () => {
    const p = preparar();
    const r = registrarTextoLocal(p.ctx, 'me pagan 8 mil cada mes el 30', 'voz');
    if (r?.resultado !== 'ingreso_por_confirmar') throw new Error(`llegó ${r?.resultado}`);
    expect(r.propuesta.anterior).toBeNull();
  });
});

describe('saldo dicho («tengo 4,200 en BBVA», `04 §6` caso 22)', () => {
  it('propone el ajuste y solo lo registra al confirmar; Deshacer lo regresa', () => {
    const p = preparar();
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 435_000 });
    const r = registrarTextoLocal(p.ctx, 'tengo 4,200 en BBVA', 'voz');
    if (r?.resultado !== 'saldo_por_confirmar') throw new Error(`llegó ${r?.resultado}`);
    expect(r.propuesta).toEqual({ cuentaId: bbva, nombre: 'BBVA', saldoLibro: 435_000, saldoReal: 420_000 });
    expect(p.ctx.libro.saldo(bbva)).toBe(435_000);
    const id = confirmarSaldoDicho(p.ctx, r.propuesta);
    expect(p.ctx.libro.saldo(bbva)).toBe(420_000);
    if (!id) throw new Error('sin conciliación');
    deshacer(p.ctx, id);
    expect(p.ctx.libro.saldo(bbva)).toBe(435_000);
  });

  it('si ya cuadraba no cambia nada, y el efectivo va al arqueo', () => {
    const p = preparar();
    agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 420_000 });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Efectivo', saldo: 50_000 });
    expect(registrarTextoLocal(p.ctx, 'tengo 4,200 en BBVA', 'voz')).toEqual({
      resultado: 'saldo_sin_cambio',
      nombre: 'BBVA',
      monto: 420_000,
    });
    const r = registrarTextoLocal(p.ctx, 'tengo 300 en efectivo', 'voz');
    expect(r?.resultado === 'arqueo' || r === null).toBe(true);
  });
});
