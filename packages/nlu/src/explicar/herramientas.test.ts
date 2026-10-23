import { describe, expect, it } from 'vitest';
import {
  compraDeHerramienta,
  consultaDeHerramienta,
  HERRAMIENTAS_EXPLICAR,
  type ResolverPeriodos,
} from './herramientas';

describe('herramientas del modo explicar (06 §6)', () => {
  it('son las consultas de solo lectura de 06 §6, con JSON Schema de objeto sin claves extra', () => {
    expect(HERRAMIENTAS_EXPLICAR.map((h) => h.nombre)).toEqual([
      'hoy',
      'me_alcanza',
      'gasto',
      'mayores_gastos',
      'comparar_periodos',
      'saldos',
      'tarjetas',
      'compromisos',
      'por_cobrar',
      'suscripciones',
    ]);
    for (const h of HERRAMIENTAS_EXPLICAR) {
      expect(h.parametros).toMatchObject({ type: 'object', additionalProperties: false });
      // Límites del proxy (`_shared/llm/contrato.ts`).
      expect(JSON.stringify(h.parametros).length).toBeLessThanOrEqual(2048);
      expect(h.descripcion.length).toBeLessThanOrEqual(400);
    }
  });

  it.each([
    ['hoy', {}, { tipo: 'hoy_puedes' }],
    ['tarjetas', undefined, { tipo: 'deuda_tarjetas' }],
    ['saldos', { alias: 'bbva' }, { tipo: 'saldo', alias: 'bbva' }],
    ['saldos', {}, { tipo: 'saldo' }],
    ['por_cobrar', { persona: 'juan' }, { tipo: 'por_cobrar', contraparte: 'juan' }],
    ['suscripciones', {}, { tipo: 'suscripciones' }],
    ['gasto', {}, { tipo: 'gasto_total' }],
    [
      'gasto',
      { desde: '2026-09-01', hasta: '2026-09-30', categoria: 'comida' },
      { tipo: 'gasto_por_categoria', desde: '2026-09-01', hasta: '2026-09-30', categoria: 'comida' },
    ],
    ['mayores_gastos', { limite: 3 }, { tipo: 'mayores_gastos', limite: 3 }],
    ['compromisos', { desde: '2026-10-11' }, { tipo: 'compromisos', desde: '2026-10-11' }],
    ['comparar_periodos', {}, { tipo: 'comparar_periodos' }],
    [
      'comparar_periodos',
      {
        actual_desde: '2026-10-01',
        actual_hasta: '2026-10-11',
        anterior_desde: '2026-09-01',
        anterior_hasta: '2026-09-11',
        categoria: 'transporte',
      },
      {
        tipo: 'comparar_periodos',
        actual: { desde: '2026-10-01', hasta: '2026-10-11' },
        anterior: { desde: '2026-09-01', hasta: '2026-09-11' },
        categoria: 'transporte',
      },
    ],
  ])('%s %j → consulta tipada', (nombre, argumentos, consulta) => {
    expect(consultaDeHerramienta(nombre, argumentos)).toEqual(consulta);
  });

  it.each([
    ['borrar_todo', {}],
    ['hoy', { extra: 1 }],
    ['gasto', { desde: '2026-02-30' }],
    ['gasto', { desde: '2026-10-11', hasta: '2026-10-01' }],
    ['gasto', { categoria: 'sueldo' }],
    ['gasto', { categoria: 'mercancia' }],
    ['mayores_gastos', { limite: 50 }],
    ['comparar_periodos', { actual_desde: '2026-10-01' }],
    ['saldos', { alias: '' }],
    ['toString', {}],
  ])('rechaza %s %j', (nombre, argumentos) => {
    expect(consultaDeHerramienta(nombre, argumentos)).toBeNull();
  });

  // Un teléfono ficticio: hoy jueves 2026-10-22, último ingreso el 15, el anterior el 30 sep, el próximo el 31.
  const periodos: ResolverPeriodos = {
    gasto: (p) =>
      ({
        esta_quincena: { desde: '2026-10-15', hasta: '2026-10-22' },
        semana_pasada: { desde: '2026-10-12', hasta: '2026-10-18' },
      })[p as string] ?? null,
    pagos: (p) => (p === 'esta_quincena' ? { desde: '2026-10-22', hasta: '2026-10-30' } : null),
    comparar: (p) =>
      p === 'esta_quincena'
        ? {
            actual: { desde: '2026-10-15', hasta: '2026-10-22' },
            anterior: { desde: '2026-09-30', hasta: '2026-10-07' },
          }
        : null,
  };

  it.each([
    [
      'gasto',
      { periodo: 'esta_quincena', categoria: 'comida' },
      { tipo: 'gasto_por_categoria', desde: '2026-10-15', hasta: '2026-10-22', categoria: 'comida' },
    ],
    // Con periodo y fechas a la vez, gana el periodo.
    [
      'mayores_gastos',
      { periodo: 'semana_pasada', desde: '2020-01-01', limite: 3 },
      { tipo: 'mayores_gastos', desde: '2026-10-12', hasta: '2026-10-18', limite: 3 },
    ],
    [
      'compromisos',
      { periodo: 'esta_quincena' },
      { tipo: 'compromisos', desde: '2026-10-22', hasta: '2026-10-30' },
    ],
    [
      'comparar_periodos',
      { periodo: 'esta_quincena', categoria: 'super' },
      {
        tipo: 'comparar_periodos',
        actual: { desde: '2026-10-15', hasta: '2026-10-22' },
        anterior: { desde: '2026-09-30', hasta: '2026-10-07' },
        categoria: 'super',
      },
    ],
  ])('periodo con nombre: %s %j → fechas del teléfono', (nombre, argumentos, consulta) => {
    expect(consultaDeHerramienta(nombre, argumentos, periodos)).toEqual(consulta);
  });

  it('un periodo que el teléfono no puede resolver, sin resolvedor o desconocido: null', () => {
    expect(consultaDeHerramienta('gasto', { periodo: 'mes_pasado' }, periodos)).toBeNull();
    expect(consultaDeHerramienta('gasto', { periodo: 'esta_quincena' })).toBeNull();
    expect(consultaDeHerramienta('gasto', { periodo: 'la_otra_semana' }, periodos)).toBeNull();
    expect(consultaDeHerramienta('compromisos', { periodo: 'ayer' }, periodos)).toBeNull();
    expect(consultaDeHerramienta('comparar_periodos', { periodo: 'mes_pasado' }, periodos)).toBeNull();
  });

  it('me_alcanza: el precio que dijo en pesos pasa a centavos; no es una consulta tipada', () => {
    expect(compraDeHerramienta('me_alcanza', { precio: 500, descripcion: 'unos tenis' })).toEqual({
      precio: 50_000,
      descripcion: 'unos tenis',
    });
    expect(compraDeHerramienta('me_alcanza', { precio: 1099.9, fecha: '2026-10-31', meses: 6 })).toEqual({
      precio: 109_990,
      fecha: '2026-10-31',
      meses: 6,
    });
    expect(consultaDeHerramienta('me_alcanza', { precio: 500 })).toBeNull();
    expect(compraDeHerramienta('gasto', { precio: 500 })).toBeNull();
    for (const malo of [
      {},
      { precio: 0 },
      { precio: -5 },
      { precio: 500, meses: 1 },
      { precio: 500, extra: 1 },
    ]) {
      expect(compraDeHerramienta('me_alcanza', malo)).toBeNull();
    }
    const def = HERRAMIENTAS_EXPLICAR.find((h) => h.nombre === 'me_alcanza');
    expect(def?.parametros).toMatchObject({ required: ['precio'] });
  });
});
