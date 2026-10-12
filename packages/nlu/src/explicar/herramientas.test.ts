import { describe, expect, it } from 'vitest';
import { consultaDeHerramienta, HERRAMIENTAS_EXPLICAR } from './herramientas';

describe('herramientas del modo explicar (06 §6)', () => {
  it('son las consultas de solo lectura de 06 §6, con JSON Schema de objeto sin claves extra', () => {
    expect(HERRAMIENTAS_EXPLICAR.map((h) => h.nombre)).toEqual([
      'hoy',
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
});
