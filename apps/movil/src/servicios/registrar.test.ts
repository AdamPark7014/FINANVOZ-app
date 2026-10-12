import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { deshacer, registrarMovimiento } from './formulario';
import { listarMovimientos } from './movimientos';
import { agregarCuenta, agregarTarjetaCredito } from './onboarding';
import {
  confirmarRegistro,
  contarPorInterpretar,
  descartarPorInterpretar,
  listarPorInterpretar,
  registrarTexto,
} from './registrar';
import { abrirPrueba } from './__pruebas__/base';

function conCuentas() {
  const p = abrirPrueba();
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 64_000 });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 359_000, alias: ['nomina'] });
  const nu = agregarTarjetaCredito(p.ctx, {
    nombre: 'Nu',
    alias: ['morada'],
    diaCorte: 28,
    diaLimitePago: 18,
    limiteCredito: 1_500_000,
    modo: 'totalero',
    saldo: 200_000,
  }).cuentaId;
  return { ...p, efectivo, bbva, nu };
}

describe('registrar por voz o texto', () => {
  it('CA-M2-02 · "coca 25 en efectivo" se registra sin red, el efectivo baja $25 y Deshacer lo regresa', () => {
    const p = conCuentas();
    const antes = p.ctx.libro.saldo(p.efectivo);
    const r = registrarTexto(p.ctx, 'coca 25 en efectivo', 'voz');
    if (r.resultado !== 'registrado') throw new Error(`se esperaba registro, llegó ${r.resultado}`);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(antes - 2_500);
    expect(r.movimientos).toEqual([
      {
        transaccionId: expect.any(String),
        tipo: 'gasto',
        descripcion: 'coca',
        monto: 2_500,
        categoria: 'Antojos',
        cuenta: 'Cartera',
        porAsignar: false,
      },
    ]);
    const t = p.ctx.libro.obtener(r.movimientos[0]?.transaccionId as string);
    expect(t).toMatchObject({ tipo: 'gasto', origen: 'voz', fecha: '2026-10-11' });

    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(antes);
    expect(listarMovimientos(p.ctx)).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('sin método de pago queda "por asignar" (caso 13)', () => {
    const p = conCuentas();
    const r = registrarTexto(p.ctx, 'coca 25');
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(r.movimientos[0]?.porAsignar).toBe(true);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-2_500);
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.insignias).toEqual(['por_asignar']);
  });

  it('con alias de tarjeta registra contra la tarjeta', () => {
    const p = conCuentas();
    const r = registrarTexto(p.ctx, 'tacos 80 con la morada');
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 - 8_000);
  });

  it('lo que el nivel 0 no cubre queda "por interpretar" sin tocar el libro', () => {
    const p = conCuentas();
    const r = registrarTexto(p.ctx, 'ayer le pasé 200 a mi jefa', 'voz');
    expect(r.resultado).toBe('por_interpretar');
    expect(listarMovimientos(p.ctx)).toEqual([]);
    expect(contarPorInterpretar(p.ctx)).toBe(1);
    const [frase] = listarPorInterpretar(p.ctx);
    expect(frase).toMatchObject({ texto: 'ayer le pasé 200 a mi jefa', origen: 'voz', fecha: '2026-10-11' });
    descartarPorInterpretar(p.ctx, frase?.id as string);
    expect(contarPorInterpretar(p.ctx)).toBe(0);
  });

  it('más de $5,000 pide confirmación; "Guardar" registra', () => {
    const p = conCuentas();
    const r = registrarTexto(p.ctx, 'compré una tele de 6000 en efectivo');
    if (r.resultado !== 'confirmar') throw new Error(r.resultado);
    expect(r.motivo).toBe('monto_alto');
    expect(listarMovimientos(p.ctx)).toEqual([]);
    const [propuesta] = r.propuestas;
    expect(propuesta?.entrada).toMatchObject({ tipo: 'gasto', monto: 600_000, origenId: p.efectivo });
    const guardado = confirmarRegistro(p.ctx, [propuesta?.entrada as never], 'texto');
    expect(guardado.movimientos[0]?.monto).toBe(600_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 600_000);
  });

  it('retiro con dos cuentas de débito pregunta cuál (chips con candidatas)', () => {
    const p = conCuentas();
    agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'Banorte', saldo: 0 });
    const r = registrarTexto(p.ctx, 'saqué 500 del cajero');
    if (r.resultado !== 'confirmar') throw new Error(r.resultado);
    expect(r.motivo).toBe('cuenta');
    expect(r.propuestas[0]?.faltan[0]).toMatchObject({ campo: 'origenId', motivo: 'ambigua' });
    expect(r.propuestas[0]?.faltan[0]?.candidatas.map((c) => c.nombre).sort()).toEqual(['BBVA', 'Banorte']);
  });

  it('"cuánto puedo gastar" es una consulta, no un registro', () => {
    const p = conCuentas();
    expect(registrarTexto(p.ctx, 'cuánto puedo gastar hoy')).toEqual({
      resultado: 'consulta',
      consulta: 'hoy_puedes',
    });
  });
});

describe('formulario de movimiento', () => {
  it('registra cada tipo que origina el usuario y valida el patrón de cuentas', () => {
    const p = conCuentas();
    registrarMovimiento(p.ctx, {
      tipo: 'ingreso',
      monto: 100_000,
      categoria: 'honorarios',
      destinoId: p.bbva,
    });
    registrarMovimiento(p.ctx, {
      tipo: 'transferencia',
      monto: 10_000,
      origenId: p.bbva,
      destinoId: p.efectivo,
    });
    registrarMovimiento(p.ctx, {
      tipo: 'retiro_efectivo',
      monto: 5_000,
      origenId: p.bbva,
      destinoId: p.efectivo,
    });
    registrarMovimiento(p.ctx, { tipo: 'pago_tarjeta', monto: 50_000, origenId: p.bbva, destinoId: p.nu });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 1_000,
      categoria: 'super',
      origenId: p.nu,
      comercio: 'OXXO',
    });
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000 + 100_000 - 10_000 - 5_000 - 50_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 + 10_000 + 5_000);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 + 50_000 - 1_000);
    // Un pago de tarjeta hacia una cuenta de débito no es un patrón válido.
    expect(() =>
      registrarMovimiento(p.ctx, {
        tipo: 'pago_tarjeta',
        monto: 1_000,
        origenId: p.efectivo,
        destinoId: p.bbva,
      }),
    ).toThrow(expect.objectContaining({ codigo: 'patron_invalido' }));
    expect(() =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', monto: 1.5, categoria: 'super', origenId: p.efectivo }),
    ).toThrow(expect.objectContaining({ codigo: 'movimiento_invalido' }));
    const dias = listarMovimientos(p.ctx);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.etiqueta).toBe('11 oct');
    expect(dias[0]?.movimientos.map((m) => m.tipo)).toEqual([
      'gasto',
      'pago_tarjeta',
      'retiro_efectivo',
      'transferencia',
      'ingreso',
    ]);
    expect(dias[0]?.movimientos[0]).toMatchObject({
      sentido: 'salida',
      saleDe: ['Nu'],
      categoria: 'Súper',
      monto: 1_000,
      comercio: 'OXXO',
    });
  });
});
