import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarCuentas } from './cuentas';
import { registrarCuentaDividida, repartoCuentaDividida, resolverParticipantes } from './cuenta-dividida';
import { deshacer } from './formulario';
import { listarMovimientos } from './movimientos';
import { agregarCuenta, agregarTarjetaCredito } from './onboarding';
import { crearPersona, listarPersonas, registrarPrestamo } from './personas';
import {
  confirmarCuentaDividida,
  procesarPorInterpretar,
  registrarTexto,
  registrarTextoLocal,
} from './registrar';
import { abrirPrueba, golden, vector } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

function base() {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 359_000 });
  const nu = agregarTarjetaCredito(p.ctx, {
    nombre: 'Nu',
    diaCorte: 28,
    diaLimitePago: 18,
    limiteCredito: 1_500_000,
    modo: 'totalero',
    saldo: 0,
  }).cuentaId;
  const caro = crearPersona(p.ctx, { nombre: 'Carolina Pérez', alias: ['Caro'] });
  const juan = crearPersona(p.ctx, { nombre: 'Juan' });
  const ana = crearPersona(p.ctx, { nombre: 'Ana' });
  return { ...p, bbva, nu, caro, juan, ana };
}

const asientosDe = (p: ReturnType<typeof base>, id: string) =>
  p.ctx.libro.obtener(id)?.asientos.map((a) => [a.cuentaId, a.monto]);

describe('E12.1 en servicios · reparto', () => {
  for (const id of ['E12-01', 'E12-02', 'E12-03', 'E12-04']) {
    it(`${id} · la vista previa es la de dividirCuenta`, () => {
      const v = vector<{
        total: number;
        partes: number;
        esperado: { parte_usuario: number; partes_otros: number[]; por_cobrar_total: number };
      }>(id);
      expect(repartoCuentaDividida(v.total, v.partes)).toEqual({
        parteUsuario: v.esperado.parte_usuario,
        partesOtros: v.esperado.partes_otros,
        porCobrarTotal: v.esperado.por_cobrar_total,
      });
    });
  }

  it('sin total o con partes fuera de rango no hay vista previa', () => {
    expect(repartoCuentaDividida(null, 4)).toBeNull();
    expect(repartoCuentaDividida(120_000, 1)).toBeNull();
    expect(repartoCuentaDividida(3, 4)).toBeNull();
    expect(repartoCuentaDividida(120_000, 51)).toBeNull();
  });
});

describe('registrarCuentaDividida', () => {
  it('caso 8 por formulario: tu parte a gasto, cada amigo en Te deben, la tarjeta por el total', () => {
    const p = base();
    const r = registrarCuentaDividida(p.ctx, {
      total: 120_000,
      partes: 4,
      personaIds: [p.caro, p.juan, p.ana],
      origenId: p.nu,
      categoria: 'comida_fuera',
      descripcion: 'la cena',
    });
    expect(asientosDe(p, r.transaccionId)).toEqual([
      ['cat:personal:comida_fuera', 30_000],
      [p.caro, 30_000],
      [p.juan, 30_000],
      [p.ana, 30_000],
      [p.nu, -120_000],
    ]);
    expect(p.ctx.libro.obtener(r.transaccionId)?.tipo).toBe('cuenta_dividida');
    expect(r.reparto).toEqual({
      parteUsuario: 30_000,
      partesOtros: [30_000, 30_000, 30_000],
      porCobrarTotal: 90_000,
    });
    // No es ingreso: ninguna cuenta de ingreso se movió.
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    const [mov] = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(mov).toMatchObject({ tipo: 'cuenta_dividida', sentido: 'salida', categoria: 'Comida fuera' });
  });

  it('el centavo sobrante va a tu parte, no a lo que te deben', () => {
    const p = base();
    registrarCuentaDividida(p.ctx, {
      total: 100,
      partes: 3,
      personaIds: [p.caro, p.juan],
      origenId: p.bbva,
      categoria: 'comida_fuera',
    });
    expect(p.ctx.libro.saldo(p.caro)).toBe(33);
    expect(p.ctx.libro.saldo(p.juan)).toBe(33);
    expect(p.ctx.libro.saldo('cat:personal:comida_fuera')).toBe(34);
  });

  it('sin con qué pagaste usa "por asignar"', () => {
    const p = base();
    registrarCuentaDividida(p.ctx, {
      total: 65_000,
      partes: 3,
      personaIds: [p.caro, p.juan],
      origenId: CUENTAS_SISTEMA.porAsignar,
      categoria: 'comida_fuera',
    });
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-65_000);
  });

  it('la misma persona puede deber más de una parte; el centavo sobrante va a tu parte', () => {
    const p = base();
    const r = registrarCuentaDividida(p.ctx, {
      total: 101,
      partes: 4,
      personaIds: [p.caro, p.caro, p.juan],
      origenId: p.bbva,
      categoria: 'comida_fuera',
    });
    expect(asientosDe(p, r.transaccionId)).toEqual([
      ['cat:personal:comida_fuera', 26],
      [p.caro, 25],
      [p.caro, 25],
      [p.juan, 25],
      [p.bbva, -101],
    ]);
    expect(p.ctx.libro.saldo(p.caro)).toBe(50);
    expect(p.ctx.libro.saldo(p.juan)).toBe(25);
    expect(r.reparto?.parteUsuario).toBe(26);
  });

  it('rechaza partes de menos o una cuenta que no es persona', () => {
    const p = base();
    const comun = { total: 120_000, partes: 4, origenId: p.nu, categoria: 'comida_fuera' };
    expect(() => registrarCuentaDividida(p.ctx, { ...comun, personaIds: [p.caro, p.juan] })).toThrow(
      ErrorDominio,
    );
    expect(() => registrarCuentaDividida(p.ctx, { ...comun, personaIds: [p.caro, p.juan, p.bbva] })).toThrow(
      ErrorDominio,
    );
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });
});

describe('resolverParticipantes', () => {
  it('por nombre o alias normalizado; lo desconocido o ambiguo queda sin resolver', () => {
    const p = base();
    crearPersona(p.ctx, { nombre: 'Ana López', alias: ['Ana'] });
    expect(resolverParticipantes(p.ctx, ['caro', 'JUAN', 'Pepe', 'ana'])).toEqual({
      personaIds: [p.caro, p.juan],
      sinResolver: ['Pepe', 'ana'],
    });
  });
});

describe('CA-M8-01 · cuenta dividida por voz', () => {
  const D01 = golden('D01');

  it('"Cena de 1,200 entre 4 con la Nu" con tres contactos: caso 8, Te deben $300 c/u y el cobro de Caro la deja en 0', async () => {
    const p = base();
    const f = nubeFalsa({ [D01.texto]: D01.esperado });
    // Desde el nivel 0 ampliado (06 §9) la propone sin nube; con nube el resultado es el mismo.
    expect(registrarTextoLocal(p.ctx, D01.texto, 'voz')).toMatchObject({ resultado: 'confirmar_division' });
    const r = await registrarTexto(p.ctx, D01.texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'confirmar_division') throw new Error(r.resultado);
    expect(r.propuesta).toMatchObject({
      total: 120_000,
      partes: 4,
      categoria: 'comida_fuera',
      origenId: p.nu,
      faltaOrigen: null,
      personaIds: [],
      sinResolver: [],
    });
    // Nada se registra antes de elegir con quién.
    expect(listarMovimientos(p.ctx)).toEqual([]);

    const g = confirmarCuentaDividida(
      p.ctx,
      {
        total: r.propuesta.total,
        partes: 4,
        personaIds: [p.caro, p.juan, p.ana],
        origenId: p.nu,
        categoria: r.propuesta.categoria,
        fecha: r.propuesta.fecha,
      },
      'voz',
    );
    expect(asientosDe(p, g.registro.transaccionId)).toEqual([
      ['cat:personal:comida_fuera', 30_000],
      [p.caro, 30_000],
      [p.juan, 30_000],
      [p.ana, 30_000],
      [p.nu, -120_000],
    ]);
    expect(p.ctx.libro.obtener(g.registro.transaccionId)?.origen).toBe('voz');
    expect(listarCuentas(p.ctx).teDeben).toEqual([
      { id: p.ana, nombre: 'Ana', saldo: 30_000 },
      { id: p.caro, nombre: 'Carolina Pérez', saldo: 30_000 },
      { id: p.juan, nombre: 'Juan', saldo: 30_000 },
    ]);

    // "Ya me pagó": un cobro de $300 de Caro deja su saldo en 0 (no es ingreso).
    registrarPrestamo(p.ctx, { tipo: 'cobro_prestamo', personaId: p.caro, cuentaId: p.bbva, monto: 30_000 });
    expect(listarPersonas(p.ctx).find((x) => x.cuentaId === p.caro)?.saldo).toBe(0);
    expect(listarCuentas(p.ctx).teDeben.map((x) => x.id)).toEqual([p.ana, p.juan]);
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000 + 30_000);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('D03: los nombres dichos que son contactos ya vienen elegidos; Deshacer anula todo', async () => {
    const p = base();
    const D03 = golden('D03');
    const f = nubeFalsa({ [D03.texto]: D03.esperado });
    const r = await registrarTexto(p.ctx, D03.texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'confirmar_division') throw new Error(r.resultado);
    expect(r.propuesta).toMatchObject({
      total: 65_000,
      partes: 3,
      personaIds: [p.caro, p.juan],
      sinResolver: [],
    });
    // Sin método de pago: va a "por asignar" (06 §5).
    expect(r.propuesta.origenId).toBe(CUENTAS_SISTEMA.porAsignar);
    const g = confirmarCuentaDividida(
      p.ctx,
      {
        total: 65_000,
        partes: 3,
        personaIds: [...r.propuesta.personaIds],
        origenId: r.propuesta.origenId as string,
        categoria: r.propuesta.categoria,
      },
      'voz',
    );
    // 65,000 / 3 con mayor residuo (E12.1): tu parte 216.67, Caro 216.67, Juan 216.66.
    expect(p.ctx.libro.saldo(p.caro)).toBe(21_667);
    expect(p.ctx.libro.saldo(p.juan)).toBe(21_666);
    deshacer(p.ctx, g.deshacer);
    expect(p.ctx.libro.saldo(p.caro)).toBe(0);
    expect(listarCuentas(p.ctx).teDeben).toEqual([]);
  });

  it('D04 sin categoría ni cuenta conocida: se propone "otros gastos" y la cuenta por elegir', async () => {
    const p = base();
    const D04 = golden('D04');
    const f = nubeFalsa({ [D04.texto]: D04.esperado });
    const r = await registrarTexto(p.ctx, D04.texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'confirmar_division') throw new Error(r.resultado);
    expect(r.propuesta).toMatchObject({ total: 180_000, partes: 6, categoria: 'otros_gastos' });
  });

  it('en la cola "por interpretar" queda para revisar (necesita a la persona)', async () => {
    const p = base();
    // «los demás» no dice cuántos son: el nivel 0 la deja a la nube (06 §9.3). La nube contesta como en D03.
    const D03 = golden('D03');
    const texto = 'pagué la cena, 1,800, y los demás me deben su parte';
    const f = nubeFalsa({ [texto]: D03.esperado });
    const r = await registrarTexto(p.ctx, texto, 'voz', { nube: null });
    expect(r.resultado).toBe('por_interpretar');
    expect(await procesarPorInterpretar(p.ctx, f.nube)).toEqual({
      aplicadas: 0,
      porRevisar: 1,
      pendientes: 0,
    });
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });
});
