// Planes Gratis y Plus (RF-PAG-01, `01 §11`) y CA-M7-07: al terminar la prueba sin pagar o al cancelar Plus la
// cuenta vuelve a Gratis; todos los datos siguen visibles y editables, exportar funciona y solo se ocultan las
// funciones de Plus.
import { describe, expect, it } from 'vitest';
import { exportarCsv, exportarJson } from '../privacidad/exportar';
import { aplicarCorreccion } from './correcciones';
import { listarCuentas } from './cuentas';
import { anularMovimiento, registrarMovimiento } from './formulario';
import { obtenerHoy } from './hoy';
import { listarMovimientos } from './movimientos';
import { listarPlanesMsi } from './msi';
import {
  DIAS_PRUEBA,
  esPlusDePrueba,
  fijarPlusDePrueba,
  funcionesPlan,
  obtenerPlan,
  sincronizarPlan,
  SIN_PLUS,
  type EstadoTienda,
} from './plan';
import { cargarEscenario } from './semilla';
import { detalleTarjeta, listarTarjetas, tarjetaDelDia } from './vista-tarjetas';
import { abrirPrueba, escenario } from './__pruebas__/base';

const DIA = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);

const enPrueba = (desde: number): EstadoTienda => ({
  plus: { vigenteHasta: desde + DIAS_PRUEBA * DIA, enPrueba: true, renovara: true },
});

describe('plan (RF-PAG-01)', () => {
  it('sin nada de la tienda la cuenta es Gratis y no muestra funciones de Plus', () => {
    const p = abrirPrueba();
    expect(obtenerPlan(p.ctx)).toEqual({
      plan: 'gratis',
      enPrueba: false,
      diasRestantes: null,
      vigenteHasta: null,
      fechaFin: null,
      renovara: false,
      terminoPlus: null,
      plusDePrueba: false,
    });
    expect(funcionesPlan(p.ctx)).toEqual({
      probabilidad: false,
      tarjetaDelDia: false,
      meAlcanza: false,
      compromisoMsi12Meses: false,
      consultas: false,
      explicar: false,
      deducciones: false,
      interpretacionesNubeMes: 30,
    });
  });

  it('prueba de 14 días: Plus con días restantes; todas las funciones de Plus y 300 interpretaciones', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    sincronizarPlan(p.ctx, enPrueba(T0));
    p.reloj.fijarInstante(T0 + 3 * DIA + 1000);
    expect(obtenerPlan(p.ctx)).toMatchObject({
      plan: 'plus',
      fechaFin: '2026-10-25',
      enPrueba: true,
      diasRestantes: 11,
      renovara: true,
    });
    expect(funcionesPlan(p.ctx)).toEqual({
      probabilidad: true,
      tarjetaDelDia: true,
      meAlcanza: true,
      compromisoMsi12Meses: true,
      consultas: true,
      explicar: true,
      deducciones: true,
      interpretacionesNubeMes: 300,
    });
  });

  it('la prueba vence sin pagar aunque el teléfono no haya hablado con la tienda: vuelve a Gratis', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    sincronizarPlan(p.ctx, enPrueba(T0));
    p.reloj.fijarInstante(T0 + DIAS_PRUEBA * DIA + 1);
    expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', terminoPlus: 'prueba' });
    expect(funcionesPlan(p.ctx).probabilidad).toBe(false);
  });

  it('cancelar deja Plus hasta el vencimiento y luego Gratis', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    sincronizarPlan(p.ctx, { plus: { vigenteHasta: T0 + 10 * DIA, enPrueba: false, renovara: false } });
    expect(obtenerPlan(p.ctx)).toMatchObject({
      plan: 'plus',
      enPrueba: false,
      renovara: false,
      diasRestantes: 10,
    });
    p.reloj.fijarInstante(T0 + 10 * DIA);
    expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', terminoPlus: 'suscripcion' });
    // La tienda confirma que ya no hay derecho.
    sincronizarPlan(p.ctx, SIN_PLUS);
    expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', terminoPlus: 'suscripcion' });
  });

  it('una tienda que dice Plus ya vencido no activa nada', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    sincronizarPlan(p.ctx, { plus: { vigenteHasta: T0 - 1, enPrueba: false, renovara: false } });
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');
  });
});

describe('Plus de prueba sin tienda (EXPO_PUBLIC_PLUS_SIN_TIENDA, decisión del 22-10-2026)', () => {
  it('encendido: todas las funciones de Plus, sin cobro, sin fecha y sin vencer', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    fijarPlusDePrueba(p.ctx, true);
    expect(obtenerPlan(p.ctx)).toEqual({
      plan: 'plus',
      enPrueba: true,
      diasRestantes: null,
      vigenteHasta: null,
      fechaFin: null,
      renovara: false,
      terminoPlus: null,
      plusDePrueba: true,
    });
    expect(funcionesPlan(p.ctx)).toEqual({
      probabilidad: true,
      tarjetaDelDia: true,
      meAlcanza: true,
      compromisoMsi12Meses: true,
      consultas: true,
      explicar: true,
      deducciones: true,
      // El proxy aplica el cupo según la tienda y no sabe de la prueba: no se promete el de Plus.
      interpretacionesNubeMes: 30,
    });
    // No vence con el tiempo: dura lo que dure la build de prueba.
    p.reloj.fijarInstante(T0 + 365 * DIA);
    expect(funcionesPlan(p.ctx).meAlcanza).toBe(true);
  });

  it('no escribe nada en la base: apagado (build con tienda o sin la variable) todo vuelve a lo de la tienda', () => {
    const p = abrirPrueba();
    p.reloj.fijarInstante(T0);
    fijarPlusDePrueba(p.ctx, true);
    expect(esPlusDePrueba(p.ctx)).toBe(true);
    fijarPlusDePrueba(p.ctx, false);
    expect(esPlusDePrueba(p.ctx)).toBe(false);
    expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', plusDePrueba: false, terminoPlus: null });
    expect(Object.values(funcionesPlan(p.ctx)).filter((v) => v === true)).toEqual([]);
    // Con Plus de la tienda, apagado la tienda manda igual que hoy.
    sincronizarPlan(p.ctx, enPrueba(T0));
    expect(obtenerPlan(p.ctx)).toMatchObject({
      plan: 'plus',
      enPrueba: true,
      diasRestantes: 14,
      plusDePrueba: false,
    });
  });

  it('es por base: un contexto derivado (`{ ...ctx }`) lo ve y otra base no', () => {
    const p = abrirPrueba();
    const otra = abrirPrueba();
    fijarPlusDePrueba(p.ctx, true);
    expect(funcionesPlan({ ...p.ctx, configFiscal: {} }).deducciones).toBe(true);
    expect(funcionesPlan(otra.ctx).deducciones).toBe(false);
  });

  it('CA-M7-07 sigue igual: al apagarse, los datos siguen visibles y editables y solo se ocultan las funciones', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e5-10'));
    p.reloj.fijarInstante(T0);
    fijarPlusDePrueba(p.ctx, true);
    const efectivo = e.cuentas['efectivo'] as string;
    registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'super', origenId: efectivo, monto: 9_000 });
    const enPrueba = {
      hoy: obtenerHoy(p.ctx),
      cuentas: listarCuentas(p.ctx),
      movimientos: listarMovimientos(p.ctx),
      tarjetas: listarTarjetas(p.ctx),
    };
    fijarPlusDePrueba(p.ctx, false);
    expect({
      hoy: obtenerHoy(p.ctx),
      cuentas: listarCuentas(p.ctx),
      movimientos: listarMovimientos(p.ctx),
      tarjetas: listarTarjetas(p.ctx),
    }).toEqual(enPrueba);
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });
});

describe('CA-M7-07 · al terminar la prueba sin pagar la cuenta vuelve a Gratis sin perder nada', () => {
  function cuentaConDatos() {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e5-10'));
    p.reloj.fijarInstante(T0);
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'super',
      origenId: e.cuentas['oro'] as string,
      monto: 45_000,
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'comida_fuera',
      origenId: e.cuentas['efectivo'] as string,
      monto: 12_000,
    });
    sincronizarPlan(p.ctx, enPrueba(T0));
    return { p, e };
  }

  /** Todo lo que la persona ve de sus datos. */
  function foto(p: ReturnType<typeof abrirPrueba>) {
    return {
      hoy: obtenerHoy(p.ctx),
      cuentas: listarCuentas(p.ctx),
      movimientos: listarMovimientos(p.ctx),
      tarjetas: listarTarjetas(p.ctx),
      detalles: listarTarjetas(p.ctx).map((t) => detalleTarjeta(p.ctx, t.id)),
      planesMsi: listarPlanesMsi(p.ctx),
      tarjetaDelDia: tarjetaDelDia(p.ctx),
    };
  }

  it('todos los datos siguen visibles: las vistas son idénticas en Plus y en Gratis', () => {
    const { p } = cuentaConDatos();
    const enPlus = foto(p);
    expect(enPlus.movimientos.length).toBeGreaterThan(0);
    expect(enPlus.tarjetas.length).toBe(3);
    p.reloj.fijarInstante(T0 + DIAS_PRUEBA * DIA + 1);
    sincronizarPlan(p.ctx, SIN_PLUS);
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');
    expect(foto(p)).toEqual(enPlus);
  });

  it('los datos siguen editables: registrar, corregir y borrar movimientos en Gratis', () => {
    const { p, e } = cuentaConDatos();
    p.reloj.fijarInstante(T0 + DIAS_PRUEBA * DIA + 1);
    sincronizarPlan(p.ctx, SIN_PLUS);
    const efectivo = e.cuentas['efectivo'] as string;
    const antes = listarCuentas(p.ctx).tienes.find((c) => c.id === efectivo)?.saldo ?? 0;
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'comida_fuera',
      origenId: efectivo,
      monto: 8_000,
    });
    expect(listarCuentas(p.ctx).tienes.find((c) => c.id === efectivo)?.saldo).toBe(antes - 8_000);
    const corregido = aplicarCorreccion(p.ctx, r.transaccionId, { monto: 9_000 });
    expect(corregido.despues.monto).toBe(9_000);
    anularMovimiento(p.ctx, corregido.despues.transaccionId);
    expect(listarCuentas(p.ctx).tienes.find((c) => c.id === efectivo)?.saldo).toBe(antes);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('exportar funciona en Gratis y trae todos los movimientos', () => {
    const { p } = cuentaConDatos();
    const enPlus = JSON.parse(exportarJson(p.ctx)) as { tablas: Record<string, unknown[]> };
    p.reloj.fijarInstante(T0 + DIAS_PRUEBA * DIA + 1);
    sincronizarPlan(p.ctx, SIN_PLUS);
    const enGratis = JSON.parse(exportarJson(p.ctx)) as { tablas: Record<string, unknown[]> };
    expect(enGratis.tablas['transaccion']).toEqual(enPlus.tablas['transaccion']);
    expect(enGratis.tablas['asiento']).toEqual(enPlus.tablas['asiento']);
    expect(enGratis.tablas['cuenta']).toEqual(enPlus.tablas['cuenta']);
    expect(exportarCsv(p.ctx).split('\n').length).toBeGreaterThan(1);
  });

  it('solo se ocultan las funciones de Plus', () => {
    const { p } = cuentaConDatos();
    expect(Object.values(funcionesPlan(p.ctx)).every(Boolean)).toBe(true);
    p.reloj.fijarInstante(T0 + DIAS_PRUEBA * DIA + 1);
    expect(funcionesPlan(p.ctx)).toEqual({
      probabilidad: false,
      tarjetaDelDia: false,
      meAlcanza: false,
      compromisoMsi12Meses: false,
      consultas: false,
      explicar: false,
      deducciones: false,
      interpretacionesNubeMes: 30,
    });
  });
});
