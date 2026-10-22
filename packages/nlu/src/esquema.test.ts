import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS,
  CATEGORIAS_NEGOCIO_EXCLUSIVAS,
  Interpretacion,
  MOTIVOS_ACLARAR,
  TIPOS_CONSULTA,
  TIPOS_MOVIMIENTO,
  TIPOS_REF_CUENTA,
} from './esquema';
import { cargarEsquemaJson, cargarGolden } from './eval/fixtures';

const esquemaJson = cargarEsquemaJson();
const validarJson = new Ajv2020({ allErrors: true, strict: false }).compile(esquemaJson);
const valida = (v: unknown) => ({ zod: Interpretacion.safeParse(v).success, json: validarJson(v) });

const golden = cargarGolden();
const HOY = '2026-10-11';
const mov = (extra: Record<string, unknown>) => ({
  intencion: 'registrar',
  movimientos: [{ tipo: 'gasto', monto: 100, fecha: HOY, ...extra }],
});
const ajuste = (a: Record<string, unknown>) => ({ intencion: 'configurar', ajuste: a });

describe('CA-M1-06 · los esperados del golden set validan con Zod y con esquema.json', () => {
  it('hay 164 casos', () => {
    expect(golden).toHaveLength(164);
  });

  for (const caso of golden) {
    it(caso.id, () => {
      expect(valida(caso.esperado)).toEqual({ zod: true, json: true });
    });
  }
});

const INVALIDOS: [string, unknown][] = [
  [
    'ingreso_recurrente con regla unica',
    ajuste({ tipo: 'ingreso_recurrente', regla: { tipo: 'unica', fecha: HOY } }),
  ],
  ['mercancia con espacio personal', mov({ categoria: 'mercancia', espacio: 'personal' })],
  ['mercancia sin espacio', mov({ categoria: 'mercancia' })],
  [
    'compromiso de renta_local sin espacio',
    ajuste({
      tipo: 'compromiso',
      monto: 800000,
      categoria: 'renta_local',
      regla: { tipo: 'mensual', dia: 5 },
    }),
  ],
  [
    'compromiso de impuestos en espacio personal',
    ajuste({
      tipo: 'compromiso',
      monto: 1000,
      categoria: 'impuestos',
      espacio: 'personal',
      regla: { tipo: 'mensual', dia: 17 },
    }),
  ],
  [
    'tanda con regla unica',
    ajuste({
      tipo: 'tanda',
      aportacion: 50000,
      participantes: 10,
      turno: 4,
      regla: { tipo: 'unica', fecha: HOY },
    }),
  ],
  ['regla mensual sin dia', ajuste({ tipo: 'compromiso', monto: 1000, regla: { tipo: 'mensual' } })],
  ['regla unica sin fecha', ajuste({ tipo: 'compromiso', monto: 1000, regla: { tipo: 'unica' } })],
  [
    'regla quincenal_dias con un solo dia',
    ajuste({ tipo: 'ingreso_recurrente', regla: { tipo: 'quincenal_dias', dias: [15] } }),
  ],
  ['colchon sin monto', ajuste({ tipo: 'colchon' })],
  ['ajuste desconocido', ajuste({ tipo: 'otro', monto: 1 })],
  ['monto cero en movimiento', mov({ monto: 0 })],
  ['monto con decimales', mov({ monto: 12.5 })],
  ['monto negativo', mov({ monto: -100 })],
  ['fecha con otro formato', mov({ fecha: '11/10/2026' })],
  ['campo extra en movimiento', mov({ comercio: 'oxxo' })],
  ['categoria fuera del catalogo', mov({ categoria: 'chelas' })],
  ['tipo de cuenta invalido', mov({ origen: { tipo: 'vales' } })],
  ['msi de 1 mes', mov({ tipo: 'compra_msi', msi: { meses: 1 } })],
  ['division de 1 parte', mov({ tipo: 'cuenta_dividida', division: { partes: 1 } })],
  ['descripcion vacia', mov({ descripcion: '' })],
  ['descripcion de 121 caracteres', mov({ descripcion: 'a'.repeat(121) })],
  ['registrar sin movimientos', { intencion: 'registrar', movimientos: [] }],
  [
    'registrar con 11 movimientos',
    {
      intencion: 'registrar',
      movimientos: Array.from({ length: 11 }, () => ({ tipo: 'gasto', monto: 1, fecha: HOY })),
    },
  ],
  ['corregir sin cambios', { intencion: 'corregir', objetivo: { ultimo: true }, cambios: {} }],
  ['anular con referencia vacia', { intencion: 'anular', objetivo: {} }],
  ['arqueo negativo', { intencion: 'arqueo', efectivo_real: -1 }],
  ['aclarar sin pregunta', { intencion: 'aclarar', motivo: 'monto_faltante' }],
  [
    'aclarar con 5 opciones',
    { intencion: 'aclarar', motivo: 'monto_ambiguo', pregunta: '¿?', opciones: ['a', 'b', 'c', 'd', 'e'] },
  ],
  ['consulta con limite 21', { intencion: 'consultar', consulta: { tipo: 'mayores_gastos', limite: 21 } }],
  [
    'consulta con grupo inexistente',
    { intencion: 'consultar', consulta: { tipo: 'gasto_por_categoria', categoria: 'ocio' } },
  ],
  ['simular sin precio', { intencion: 'simular', compra: { meses: 12 } }],
  ['fuera_de_alcance con motivo inventado', { intencion: 'fuera_de_alcance', motivo: 'otro' }],
  ['intencion desconocida', { intencion: 'saludar' }],
  ['saldo_cuenta sin monto', ajuste({ tipo: 'saldo_cuenta', alias: 'bbva' })],
  ['tarjeta_ciclo con dia 32', ajuste({ tipo: 'tarjeta_ciclo', dia_corte: 32 })],
  ['gasto_compartido sin fecha', { intencion: 'gasto_compartido', gasto: { monto: 100 } }],
  [
    'gasto_compartido con mi_parte 100',
    { intencion: 'gasto_compartido', gasto: { monto: 100, fecha: HOY, mi_parte: 100 } },
  ],
  [
    'gasto_compartido con pagador desconocido',
    { intencion: 'gasto_compartido', gasto: { monto: 100, fecha: HOY, pagador: 'ana' } },
  ],
  [
    'gasto_compartido de mercancia',
    { intencion: 'gasto_compartido', gasto: { monto: 100, fecha: HOY, categoria: 'mercancia' } },
  ],
];

const VALIDOS: [string, unknown][] = [
  ['mercancia con espacio negocio', mov({ categoria: 'mercancia', espacio: 'negocio' })],
  [
    'transporte en negocio (categoría de los dos espacios)',
    mov({ categoria: 'transporte', espacio: 'negocio' }),
  ],
  [
    'compromiso de renta_local en negocio',
    ajuste({
      tipo: 'compromiso',
      monto: 800000,
      categoria: 'renta_local',
      espacio: 'negocio',
      regla: { tipo: 'mensual', dia: 5 },
    }),
  ],
  [
    'compromiso con regla unica',
    ajuste({ tipo: 'compromiso', monto: 300000, regla: { tipo: 'unica', fecha: '2026-11-03' } }),
  ],
  ['colchon en cero', ajuste({ tipo: 'colchon', monto: 0 })],
  ['arqueo en cero', { intencion: 'arqueo', efectivo_real: 0 }],
  ['revisar_duplicados sin filtro', { intencion: 'revisar_duplicados', filtro: {} }],
  ['ingreso_recurrente sin regla', ajuste({ tipo: 'ingreso_recurrente', monto: 800000 })],
  ['regla anual', ajuste({ tipo: 'compromiso', monto: 980000, regla: { tipo: 'anual', mes: 2, dia: 15 } })],
  ['gasto_compartido mínimo', { intencion: 'gasto_compartido', gasto: { monto: 100, fecha: HOY } }],
];

describe('CA-M1-06 · Zod y esquema.json rechazan lo mismo', () => {
  for (const [nombre, valor] of INVALIDOS) {
    it(`rechaza: ${nombre}`, () => {
      expect(valida(valor)).toEqual({ zod: false, json: false });
    });
  }
  for (const [nombre, valor] of VALIDOS) {
    it(`acepta: ${nombre}`, () => {
      expect(valida(valor)).toEqual({ zod: true, json: true });
    });
  }

  it('Zod además rechaza una fecha civil inexistente (el JSON Schema solo revisa el patrón)', () => {
    expect(valida(mov({ fecha: '2026-02-30' }))).toEqual({ zod: false, json: true });
  });
});

describe('los catálogos de Zod coinciden con esquema.json', () => {
  const defs = esquemaJson.$defs as Record<string, Record<string, unknown>>;
  const props = (def: string) => (defs[def]?.properties ?? {}) as Record<string, Record<string, unknown>>;

  it('categorías y exclusivas del negocio', () => {
    expect([...CATEGORIAS]).toEqual(defs.categoria?.enum);
    expect([...CATEGORIAS_NEGOCIO_EXCLUSIVAS]).toEqual(defs.categoriaNegocioExclusiva?.enum);
  });

  it('tipos de movimiento, de cuenta, de consulta y motivos', () => {
    expect([...TIPOS_MOVIMIENTO]).toEqual(props('movimiento').tipo?.enum);
    expect([...TIPOS_REF_CUENTA]).toEqual(props('refCuenta').tipo?.enum);
    const consulta = props('consultar').consulta as { properties: Record<string, { enum: unknown }> };
    expect([...TIPOS_CONSULTA]).toEqual(consulta.properties.tipo?.enum);
    expect([...MOTIVOS_ACLARAR]).toEqual(props('aclarar').motivo?.enum);
  });
});
