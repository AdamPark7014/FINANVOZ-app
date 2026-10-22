import { describe, expect, it } from 'vitest';
import type { ContextoInterprete } from '../contexto';
import { compararLectura, evaluarPasos } from '../eval/evaluar-pasos';
import { cargarContexto, cargarContextoOnboarding, cargarGoldenPasos } from '../eval/fixtures';
import {
  EsquemaLecturaPaso,
  INSTITUCIONES,
  interpretarPaso,
  lecturaDesdeInterpretacion,
  type LecturaPaso,
  type Paso,
} from './index';

const onboarding = cargarContextoOnboarding();
const golden = cargarGoldenPasos();
const leer = (paso: Paso, texto: string, contexto: ContextoInterprete = onboarding) =>
  interpretarPaso(paso, texto, contexto);

describe('golden de pasos (06 §13)', () => {
  for (const caso of golden) {
    it(`${caso.id}${caso.reglas ? '' : ' (reglas: false)'}`, () => {
      const salida = leer(caso.paso as Paso, caso.texto);
      if (caso.esperado === null) {
        expect(salida).toBeNull();
        return;
      }
      expect(EsquemaLecturaPaso.safeParse(caso.esperado).success).toBe(true);
      if (caso.reglas) expect(compararLectura(caso.esperado, salida)).toEqual([]);
      else if (salida !== null) expect(compararLectura(caso.esperado, salida)).toEqual([]);
    });
  }

  it('cobertura 87/87 y precisión 100 % sobre los 100 casos', () => {
    const r = evaluarPasos(golden, onboarding);
    expect(golden).toHaveLength(100);
    expect(r.marcados).toBe(87);
    expect(r.marcadosCubiertos).toBe(87);
    expect(r.respondidos).toBe(88);
    expect(r.respondidosCorrectos).toBe(r.respondidos);
    expect(r.aprobado).toBe(true);
  });

  it('cubre los siete pasos', () => {
    expect(new Set(golden.map((c) => c.paso))).toEqual(
      new Set(['ingreso', 'efectivo', 'cuentas', 'tarjeta', 'pagos_fijos', 'colchon', 'tanda']),
    );
  });
});

describe('compararLectura', () => {
  it('normaliza los textos libres y es estricta con lo demás', () => {
    const pago = (extra: object) => ({
      paso: 'pagos_fijos',
      pagos: [{ concepto: 'la renta', monto: { monto: 100, aproximado: false }, ...extra }],
    });
    expect(
      compararLectura(pago({}), { ...pago({}), pagos: [{ ...pago({}).pagos[0], concepto: 'Renta' }] }),
    ).toEqual([]);
    expect(compararLectura(pago({}), pago({ frecuencia: 'mensual' }))).toEqual(['pagos[0].frecuencia']);
    expect(compararLectura(pago({ frecuencia: 'mensual' }), pago({}))).toEqual(['pagos[0].frecuencia']);
    expect(compararLectura({ paso: 'colchon' }, null)).toEqual(['(raíz)']);
  });
});

describe('interpretarPaso · contexto con cuentas', () => {
  const conCuentas: ContextoInterprete = {
    ...onboarding,
    cuentas: [
      { tipo: 'debito', alias: ['bbva', 'nomina'] },
      { tipo: 'credito', alias: ['nu', 'morada'] },
      { tipo: 'efectivo', alias: ['efectivo', 'cartera'] },
    ],
  };

  it('pagos fijos: «sale de» y «con» llevan el alias de una cuenta que existe', () => {
    expect(
      leer('pagos_fijos', 'la renta son 4,500 el día primero, sale de la de nómina', conCuentas),
    ).toEqual({
      paso: 'pagos_fijos',
      pagos: [
        {
          concepto: 'Renta',
          monto: { monto: 450_000, aproximado: false },
          frecuencia: 'mensual',
          regla: { tipo: 'mensual', dia: 1 },
          cuentaAlias: 'nomina',
        },
      ],
    });
    expect(
      leer('pagos_fijos', 'Netflix 219 cada mes con la morada y me faltan 3 pagos', conCuentas),
    ).toMatchObject({
      pagos: [{ concepto: 'Netflix', frecuencia: 'mensual', cuentaAlias: 'morada', pagosRestantes: 3 }],
    });
    // Una cuenta que no existe no se inventa.
    expect(leer('pagos_fijos', 'la renta son 4,500 el día primero, sale de la azul', conCuentas)).toBeNull();
  });

  it('cuentas: una cuenta real con el alias gana sobre el catálogo', () => {
    // "nu" es la tarjeta de crédito de la persona: no entra como débito del catálogo al contexto…
    expect(leer('cuentas', 'tengo 4,200 en BBVA', conCuentas)).toMatchObject({
      cuentas: [{ nombre: 'BBVA', institucion: 'bbva_mx', subtipo: 'debito' }],
    });
    // …pero la gramática del paso sí la lee como la cuenta de Nu (el paso habla de dinero que tienes).
    expect(leer('cuentas', 'tengo 300 en Nu', conCuentas)).toMatchObject({
      cuentas: [{ nombre: 'Nu', institucion: 'nu_mx', subtipo: 'debito' }],
    });
  });

  it('tarjeta: un alias real de crédito sirve como nombre', () => {
    expect(leer('tarjeta', 'la morada corta el 28 y pago el 18', conCuentas)).toEqual({
      paso: 'tarjeta',
      nombre: 'Morada',
      diaCorte: 28,
      diaLimitePago: 18,
    });
  });

  it('el contexto del golden principal no cambia lo que lee el paso de colchón', () => {
    expect(leer('colchon', 'quiero treinta y un mil de colchón', cargarContexto().contexto)).toEqual({
      paso: 'colchon',
      monto: { monto: 3_100_000, aproximado: false },
    });
  });
});

describe('interpretarPaso · ante la duda, null', () => {
  const NULOS: [Paso, string][] = [
    ['ingreso', ''],
    ['ingreso', 'me pagan 8 mil cada año el 5 de enero'],
    ['ingreso', 'me pagan 8 mil y 9 mil cada quincena'],
    ['ingreso', 'cada quincena cada mes'],
    ['ingreso', 'varía, como 8 mil'],
    ['ingreso', 'cada 15 días'],
    ['efectivo', 'tengo 500 en BBVA'],
    ['efectivo', 'más de 500'],
    ['efectivo', 'como 300 en el mercado'],
    ['cuentas', 'tengo 500'],
    ['cuentas', 'tengo 500 en efectivo y 300 en efectivo'],
    ['cuentas', 'tengo 500 en la azul'],
    ['cuentas', 'tengo 500 en BBVA y'],
    ['tarjeta', 'corta el 28 y corta el 30'],
    ['tarjeta', 'pago el 18 y tengo 20 días para pagar'],
    ['tarjeta', 'termina en 441'],
    ['tarjeta', 'mi límite es de 0'],
    ['tarjeta', 'debo 3 mil y le debo 2 mil'],
    ['pagos_fijos', 'la renta'],
    ['pagos_fijos', 'la renta son 4500 cada mes y'],
    ['pagos_fijos', 'la renta son 0 cada mes'],
    ['pagos_fijos', 'la renta son 4500 cada dos meses el 5'],
    ['colchon', 'quiero más de 500 de colchón'],
    ['colchon', 'quiero un millón de colchón'],
    ['tanda', 'son 10'],
    ['tanda', 'entré a una tanda'],
    ['tanda', 'somos 1'],
    ['tanda', 'somos 10 y somos 12'],
  ];
  for (const [paso, texto] of NULOS) {
    it(`${paso} · ${JSON.stringify(texto)}`, () => {
      expect(leer(paso, texto)).toBeNull();
    });
  }
});

describe('lecturaDesdeInterpretacion', () => {
  it('convierte lo que corresponde al paso y nada más', () => {
    expect(
      lecturaDesdeInterpretacion('efectivo', { intencion: 'arqueo', efectivo_real: 500, aproximado: true }),
    ).toEqual({ paso: 'efectivo', efectivo: { monto: 500, aproximado: true } });
    expect(lecturaDesdeInterpretacion('cuentas', { intencion: 'arqueo', efectivo_real: 0 })).toEqual({
      paso: 'cuentas',
      efectivo: { monto: 0, aproximado: false },
      cuentas: [],
    });
    expect(lecturaDesdeInterpretacion('ingreso', { intencion: 'arqueo', efectivo_real: 0 })).toBeNull();
    expect(
      lecturaDesdeInterpretacion('colchon', {
        intencion: 'configurar',
        ajuste: { tipo: 'colchon', monto: 0 },
      }),
    ).toEqual({ paso: 'colchon', monto: { monto: 0, aproximado: false } });
    expect(
      lecturaDesdeInterpretacion('ingreso', {
        intencion: 'configurar',
        ajuste: { tipo: 'ingreso_recurrente', monto: 100, regla: { tipo: 'anual', mes: 1, dia: 5 } },
      }),
    ).toBeNull();
    expect(
      lecturaDesdeInterpretacion('pagos_fijos', {
        intencion: 'configurar',
        ajuste: {
          tipo: 'compromiso',
          concepto: 'el predial',
          monto: 300,
          regla: { tipo: 'unica', fecha: '2026-11-03' },
        },
      }),
    ).toBeNull();
    expect(
      lecturaDesdeInterpretacion('tanda', {
        intencion: 'configurar',
        ajuste: {
          tipo: 'tanda',
          aportacion: 500,
          participantes: 10,
          turno: 4,
          regla: { tipo: 'quincenal_15_ultimo' },
        },
      }),
    ).toEqual({
      paso: 'tanda',
      aportacion: { monto: 500, aproximado: false },
      frecuencia: 'quincenal',
      participantes: 10,
      turno: 4,
    });
    expect(
      lecturaDesdeInterpretacion('colchon', {
        intencion: 'registrar',
        movimientos: [{ tipo: 'gasto', monto: 100, fecha: '2026-10-11' }],
      }),
    ).toBeNull();
  });
});

describe('esquema LecturaPaso', () => {
  const valida = (l: unknown) => EsquemaLecturaPaso.safeParse(l).success;
  it('rechaza lecturas vacías o incoherentes', () => {
    const invalidas: unknown[] = [
      { paso: 'ingreso' },
      { paso: 'ingreso', frecuencia: 'varia', monto: { monto: 100, aproximado: false } },
      { paso: 'ingreso', frecuencia: 'semanal', regla: { tipo: 'mensual', dia: 1 } },
      { paso: 'ingreso', monto: { monto: 0, aproximado: false } },
      { paso: 'cuentas', cuentas: [] },
      { paso: 'tarjeta' },
      { paso: 'tarjeta', diaLimitePago: 18, diasParaPagar: 20 },
      { paso: 'tarjeta', ultimos4: '441' },
      { paso: 'pagos_fijos', pagos: [] },
      {
        paso: 'pagos_fijos',
        pagos: [
          {
            concepto: 'Luz',
            monto: { monto: 100, aproximado: false },
            frecuencia: 'mensual',
            avisos: ['cada_dos_meses'],
          },
        ],
      },
      { paso: 'tanda', participantes: 3, turno: 4 },
      { paso: 'colchon', monto: { monto: 1.5, aproximado: false } },
    ];
    for (const l of invalidas) expect(valida(l), JSON.stringify(l)).toBe(false);
    const ok: LecturaPaso = { paso: 'colchon', monto: { monto: 0, aproximado: false } };
    expect(valida(ok)).toBe(true);
  });
});

describe('catálogo de instituciones', () => {
  it('cada alias es de una sola institución y cada una sirve para algo', () => {
    const alias = INSTITUCIONES.flatMap((i) => i.alias);
    expect(new Set(alias).size).toBe(alias.length);
    for (const i of INSTITUCIONES) {
      expect(i.cuenta !== null || i.credito, i.id).toBe(true);
      for (const a of i.alias) expect(a).toMatch(/^[a-z0-9ñ ]+$/);
    }
  });
});
