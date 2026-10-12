import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ErrorDominio } from '../errores';
import { sumarDias, type PlainDate } from '../fecha';
import type { Programado } from '../horizonte';
import type { Regla } from '../recurrencia';
import type { TarjetaRecomendable } from '../tarjetas';
import { cargarVectores } from '../__pruebas__/vectores';
import {
  brier,
  claseDia,
  compararEscenarios,
  construirHistorial,
  construirHorizontes,
  construirPools,
  crearComparacion,
  crearSimulacion,
  cuantil,
  DIAS_ESTIMACION_INICIAL,
  estadoDatos,
  fnv1a32,
  generarEscenarios,
  mulberry32,
  probabilidadBp,
  semillaDelDia,
  simular,
  VERSION_SIMULADOR,
  type DiaHistorial,
  type EntradaSimulacion,
  type Escenario,
  type HorizonteSimulacion,
  type ResultadoSimulacion,
  type TransaccionHistorial,
} from './index';

interface VectorSimulacion {
  id: string;
  descripcion: string;
  entrada: EntradaSimulacion;
  esperado: ResultadoSimulacion;
  probabilidad_analitica: number | null;
  tolerancia?: number;
}

interface TarjetaVector {
  id: string;
  nombre: string;
  modo: 'totalero' | 'plan';
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito: number;
  saldo_revolvente: number;
  msi_no_facturado: number;
}

interface E8 {
  mulberry32: { semilla_42_primeros_10: number[]; semilla_0_primeros_5: number[] };
  fnv1a32: { texto: string; fnv1a32: number }[];
  simulacion: VectorSimulacion[];
  historial: {
    id: string;
    transacciones: TransaccionHistorial[];
    inicio_uso: PlainDate;
    hoy: PlainDate;
    fechas_ingreso: PlainDate[];
    esperado: DiaHistorial[];
  };
  escenarios: {
    'E8-21_construir_horizontes': {
      id: string;
      hoy: PlainDate;
      regla_ingreso: Regla;
      monto_ingreso: number;
      programados: Programado[];
      hasta: PlainDate;
      recibidas: PlainDate[];
      esperado: HorizonteSimulacion[];
    };
    'E8-22_comparar_escenarios': {
      id: string;
      entrada: {
        hoy: PlainDate;
        excedente_inicial: number;
        regla_ingreso: Regla;
        monto_ingreso: number;
        programados: Programado[];
        recibidas: PlainDate[];
        tarjetas: TarjetaVector[];
        historial: DiaHistorial[];
        escenarios: Escenario[];
        semilla: number;
      };
      esperado: Record<string, unknown>;
    };
    'E8-23_generar_escenarios': {
      id: string;
      descripcion: string;
      precio: number;
      meses: number | null;
      fecha_compra: PlainDate | null;
      hoy: PlainDate;
      proximo_ingreso: PlainDate;
      tarjetas: TarjetaVector[];
      esperado: { escenarios: Escenario[]; nota: string | null };
    }[];
  };
}

const e8 = cargarVectores()['E8'] as E8;

function aTarjeta(t: TarjetaVector): TarjetaRecomendable & { nombre: string } {
  return {
    id: t.id,
    nombre: t.nombre,
    modo: t.modo,
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
    limiteCredito: t.limite_credito,
    saldoRevolvente: t.saldo_revolvente,
    msiNoFacturado: t.msi_no_facturado,
  };
}

/** Historial sintético de `dias` días con consumos que se repiten. */
function historialSintetico(
  dias: number,
  consumos: readonly number[],
  inicio = '2026-07-01',
): DiaHistorial[] {
  return Array.from({ length: dias }, (_, i) => {
    const fecha = sumarDias(inicio, i);
    return { fecha, clase: claseDia(fecha, new Set()), consumo: consumos[i % consumos.length] ?? 0 };
  });
}

describe('E8.1 PRNG y semilla', () => {
  it('mulberry32(42): los primeros 10 números bit a bit', () => {
    const g = mulberry32(42);
    expect(e8.mulberry32.semilla_42_primeros_10.map(() => g())).toEqual(e8.mulberry32.semilla_42_primeros_10);
  });

  it('mulberry32(0): los primeros 5 números bit a bit', () => {
    const g = mulberry32(0);
    expect(e8.mulberry32.semilla_0_primeros_5.map(() => g())).toEqual(e8.mulberry32.semilla_0_primeros_5);
  });

  for (const v of e8.fnv1a32) {
    it(`fnv1a32(${JSON.stringify(v.texto)}) = ${v.fnv1a32}`, () => {
      expect(fnv1a32(v.texto)).toBe(v.fnv1a32);
    });
  }

  it('fnv1a32 codifica en UTF-8 (acentos, emoji y sustitutos sueltos)', () => {
    // Referencias calculadas byte a byte con la definición de FNV-1a 32.
    const referencia = (bytes: number[]) =>
      bytes.reduce((h, b) => Math.imul(h ^ b, 0x01000193) >>> 0, 0x811c9dc5);
    expect(fnv1a32('é')).toBe(referencia([0xc3, 0xa9]));
    expect(fnv1a32('€')).toBe(referencia([0xe2, 0x82, 0xac]));
    expect(fnv1a32('😀')).toBe(referencia([0xf0, 0x9f, 0x98, 0x80]));
    expect(fnv1a32('\ud800')).toBe(referencia([0xef, 0xbf, 0xbd]));
  });

  it('semilla de producción: fnv1a32("<hoy>|v1"), igual todo el día', () => {
    expect(VERSION_SIMULADOR).toBe('v1');
    expect(semillaDelDia('2026-10-11')).toBe(1280297077);
    expect(semillaDelDia('2026-10-15')).toBe(79228953);
    expect(() => semillaDelDia('2026-13-01')).toThrow(ErrorDominio);
  });
});

describe('E8.4 simular (vectores E8.simulacion)', () => {
  it('carga los vectores', () => expect(e8.simulacion.length).toBe(9));

  for (const v of e8.simulacion) {
    it(`${v.id} · ${v.descripcion}`, () => {
      const r = simular(v.entrada);
      expect(r).toEqual(v.esperado);
      if (r.estado === 'ok' && v.probabilidad_analitica !== null) {
        expect(Math.abs(r.probabilidad - v.probabilidad_analitica)).toBeLessThanOrEqual(v.tolerancia ?? 1e-6);
      }
    });
  }

  it('por bloques da exactamente lo mismo que de una sola vez (cualquier tamaño de bloque)', () => {
    for (const v of e8.simulacion) {
      for (const bloque of [1, 7, 333, 1000, 100000]) {
        const paso = crearSimulacion(v.entrada);
        let vueltas = 0;
        while (!paso.avanzar(bloque)) vueltas++;
        expect(paso.hechas()).toBe(paso.total);
        expect(paso.resultado()).toEqual(v.esperado);
        if (v.esperado.estado === 'ok') expect(vueltas).toBe(Math.ceil(v.entrada.n / bloque) - 1);
      }
    }
  });

  it('el resultado de un paso sin terminar es un error', () => {
    const v = e8.simulacion[2] as VectorSimulacion;
    const paso = crearSimulacion(v.entrada);
    paso.avanzar(10);
    expect(() => paso.resultado()).toThrow(ErrorDominio);
    expect(() => paso.avanzar(0)).toThrow(ErrorDominio);
  });

  it('rechaza entradas inválidas', () => {
    const v = (e8.simulacion[0] as VectorSimulacion).entrada;
    expect(() => simular({ ...v, n: 0 })).toThrow(ErrorDominio);
    expect(() => simular({ ...v, n: 1.5 })).toThrow(ErrorDominio);
    expect(() => simular({ ...v, excedente_inicial: 0.5 })).toThrow(ErrorDominio);
    expect(() => simular({ ...v, semilla: -1 })).toThrow(ErrorDominio);
    expect(() => simular({ ...v, horizontes: [] })).toThrow(ErrorDominio);
    expect(() =>
      simular({
        ...v,
        horizontes: [{ inicio: '2026-10-15', fin: '2026-10-11', ingreso: 0, compromisos: 0 }],
      }),
    ).toThrow(ErrorDominio);
    expect(() =>
      simular({ ...v, historial: v.historial.map((d, i) => (i === 0 ? { ...d, consumo: -1 } : d)) }),
    ).toThrow(ErrorDominio);
  });

  it('propiedad: más excedente nunca baja los éxitos (misma semilla)', () => {
    const historial = historialSintetico(30, [0, 5000, 12000, 30000, 800]);
    fc.assert(
      fc.property(
        fc.integer({ min: -50000, max: 200000 }),
        fc.integer({ min: 0, max: 50000 }),
        (e0, extra) => {
          const base = {
            historial,
            horizontes: [{ inicio: '2026-10-11', fin: '2026-10-20', ingreso: 0, compromisos: 0 }],
            n: 300,
            semilla: 99,
          };
          const a = simular({ ...base, excedente_inicial: e0 });
          const b = simular({ ...base, excedente_inicial: e0 + extra });
          if (a.estado !== 'ok' || b.estado !== 'ok') throw new Error('estado inesperado');
          return b.exitos >= a.exitos && b.p10_h0 - a.p10_h0 === extra && b.p50_h0 - a.p50_h0 === extra;
        },
      ),
      { numRuns: 60 },
    );
  });

  it('propiedad: la misma entrada da el mismo resultado (determinista)', () => {
    const historial = historialSintetico(20, [100, 2000, 0]);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (semilla) => {
        const e = {
          historial,
          horizontes: [{ inicio: '2026-10-11', fin: '2026-10-14', ingreso: 0, compromisos: 0 }],
          excedente_inicial: 3000,
          n: 50,
          semilla,
        };
        expect(simular(e)).toEqual(simular(e));
      }),
      { numRuns: 30 },
    );
  });
});

describe('E8.2 historial y pools', () => {
  it('E8-30 · exclusiones, reparto del arqueo y días en 0', () => {
    const v = e8.historial;
    expect(construirHistorial(v.transacciones, v.inicio_uso, v.hoy, v.fechas_ingreso)).toEqual(v.esperado);
  });

  it('primer arqueo: se reparte en los 7 días que terminan en su fecha, sin pasar de inicio_uso', () => {
    const tx: TransaccionHistorial[] = [{ fecha: '2026-10-09', tipo: 'ajuste_arqueo', monto_gasto: 700 }];
    const h = construirHistorial(tx, '2026-09-01', '2026-10-11', []);
    const con = h.filter((d) => d.consumo > 0).map((d) => [d.fecha, d.consumo]);
    expect(con).toEqual([
      ['2026-10-03', 100],
      ['2026-10-04', 100],
      ['2026-10-05', 100],
      ['2026-10-06', 100],
      ['2026-10-07', 100],
      ['2026-10-08', 100],
      ['2026-10-09', 100],
    ]);
    const corto = construirHistorial(
      [{ fecha: '2026-10-09', tipo: 'ajuste_arqueo', monto_gasto: 100 }],
      '2026-10-07',
      '2026-10-11',
      [],
    );
    // 100 entre 3 días: el día más antiguo lleva el centavo extra (E1.1).
    expect(corto.map((d) => d.consumo)).toEqual([34, 33, 33, 0]);
    // Arqueo con el anterior el mismo día: todo cae en su fecha.
    const mismoDia = construirHistorial(
      [{ fecha: '2026-10-09', tipo: 'ajuste_arqueo', monto_gasto: 100, arqueo_anterior: '2026-10-09' }],
      '2026-10-07',
      '2026-10-11',
      [],
    );
    expect(mismoDia.map((d) => d.consumo)).toEqual([0, 0, 100, 0]);
  });

  it('ventana de 90 días y fuera de ella no cuenta nada', () => {
    const h = construirHistorial(
      [
        { fecha: '2026-01-01', tipo: 'gasto', monto_gasto: 5000 },
        { fecha: '2026-10-11', tipo: 'gasto', monto_gasto: 5000 },
      ],
      '2025-01-01',
      '2026-10-11',
      [],
    );
    expect(h).toHaveLength(90);
    expect(h[0]?.fecha).toBe('2026-07-13');
    expect(h.every((d) => d.consumo === 0)).toBe(true);
    expect(construirHistorial([], '2026-10-11', '2026-10-11', [])).toEqual([]);
    expect(construirHistorial([], '2026-10-20', '2026-10-11', [])).toEqual([]);
  });

  it('pools: clase con < 5 días usa todos', () => {
    const h = historialSintetico(14, [1, 2, 3, 4, 5, 6, 7]);
    const p = construirPools(h);
    expect(p.pago).toEqual(h.map((d) => d.consumo));
    expect(p.finde).toHaveLength(14); // 4 días de fin de semana < 5
    expect(p.habil).toHaveLength(10);
  });

  it('estado de datos: < 14 insuficientes, 14–41 estimación inicial, ≥ 42 normal', () => {
    expect(DIAS_ESTIMACION_INICIAL).toBe(42);
    expect(estadoDatos(0)).toBe('datos_insuficientes');
    expect(estadoDatos(13)).toBe('datos_insuficientes');
    expect(estadoDatos(14)).toBe('estimacion_inicial');
    expect(estadoDatos(20)).toBe('estimacion_inicial');
    expect(estadoDatos(41)).toBe('estimacion_inicial');
    expect(estadoDatos(42)).toBe('normal');
  });

  it('propiedad: un día por fecha, consumo ≥ 0, y la suma no pierde gastos positivos dentro de la ventana', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dia: fc.integer({ min: 0, max: 29 }),
            monto: fc.integer({ min: 0, max: 100000 }),
            tipo: fc.constantFrom('gasto', 'cuenta_dividida', 'transferencia', 'compra_msi'),
          }),
          { maxLength: 40 },
        ),
        (movs) => {
          const tx = movs.map((m) => ({
            fecha: sumarDias('2026-09-11', m.dia),
            tipo: m.tipo,
            monto_gasto: m.monto,
          }));
          const h = construirHistorial(tx, '2026-09-11', '2026-10-11', []);
          const contados = movs
            .filter((m) => m.tipo === 'gasto' || m.tipo === 'cuenta_dividida')
            .reduce((s, m) => s + m.monto, 0);
          return (
            h.length === 30 &&
            h.every((d) => d.consumo >= 0) &&
            h.reduce((s, d) => s + d.consumo, 0) === contados
          );
        },
      ),
    );
  });

  it('cuantil por rango más cercano', () => {
    expect(cuantil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1000)).toBe(1);
    expect(cuantil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5000)).toBe(5);
    expect(cuantil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 9000)).toBe(9);
    expect(cuantil([7], 1000)).toBe(7);
    expect(() => cuantil([], 5000)).toThrow(ErrorDominio);
  });
});

describe('E8.3 construirHorizontes', () => {
  const v = e8.escenarios['E8-21_construir_horizontes'];

  it(`${v.id} · quincena con renta, gimnasio, internet y luz hasta ${v.hasta}`, () => {
    expect(
      construirHorizontes(v.hoy, v.regla_ingreso, v.monto_ingreso, v.programados, v.hasta, v.recibidas),
    ).toEqual(v.esperado);
  });

  it('mínimo 2 horizontes aunque hasta sea hoy', () => {
    const h = construirHorizontes(v.hoy, v.regla_ingreso, v.monto_ingreso, v.programados, v.hoy, v.recibidas);
    expect(h).toEqual(v.esperado.slice(0, 2));
  });

  it('tope de 24 meses', () => {
    const h = construirHorizontes(v.hoy, v.regla_ingreso, v.monto_ingreso, [], '2030-01-01', v.recibidas);
    const ultimo = h[h.length - 1] as HorizonteSimulacion;
    expect(ultimo.inicio <= '2028-10-11').toBe(true);
    expect(ultimo.fin > '2028-10-11').toBe(true);
    // Semanal: alcanza también los 24 meses.
    const s = construirHorizontes(
      '2026-10-11',
      { tipo: 'semanal', dia_semana: 5 },
      100000,
      [],
      '2030-01-01',
      [],
    );
    expect((s[s.length - 1] as HorizonteSimulacion).fin > '2028-10-11').toBe(true);
  });

  it('compromisos fechados (pagos de tarjeta en plan, cuotas MSI) se suman a su horizonte; los de H₀ no', () => {
    const h = construirHorizontes(
      v.hoy,
      v.regla_ingreso,
      v.monto_ingreso,
      v.programados,
      v.hoy,
      v.recibidas,
      [
        { fecha: '2026-10-12', monto: 111 },
        { fecha: '2026-10-20', monto: 1000 },
        { fecha: '2027-12-01', monto: 5 },
      ],
    );
    expect(h[0]?.compromisos).toBe(0);
    expect(h[1]?.compromisos).toBe(20500 + 1000);
  });

  it('modo ingreso variable: solo H₀ de 30 días', () => {
    expect(construirHorizontes('2026-10-11', null, 0, v.programados, '2027-01-01', [])).toEqual([
      { inicio: '2026-10-11', fin: '2026-11-10', ingreso: 0, compromisos: 0 },
    ]);
  });
});

describe('E8.5 generarEscenarios (E8-23)', () => {
  const casos = e8.escenarios['E8-23_generar_escenarios'];
  it('carga los cinco casos', () =>
    expect(casos.map((c) => c.id)).toEqual(['E8-23a', 'E8-23b', 'E8-23c', 'E8-23d', 'E8-23e']));

  for (const c of casos) {
    it(`${c.id} · ${c.descripcion}`, () => {
      const r = generarEscenarios(
        c.precio,
        c.hoy,
        c.proximo_ingreso,
        c.tarjetas.map(aTarjeta),
        c.meses ?? undefined,
        c.fecha_compra ?? undefined,
      );
      expect({ escenarios: r.escenarios, nota: r.nota }).toEqual(c.esperado);
      if (r.nota === 'uso_alto') expect(r.uso_bp).toBeGreaterThan(3000);
    });
  }

  it('sin próximo ingreso ni fecha no hay escenario "esperar"; una fecha pasada tampoco', () => {
    const c = casos[2] as (typeof casos)[number];
    const t = c.tarjetas.map(aTarjeta);
    expect(generarEscenarios(50000, '2026-10-11', null, t).escenarios.map((e) => e.tipo)).toEqual([
      'base',
      'contado_hoy',
    ]);
    expect(generarEscenarios(50000, '2026-10-11', '2026-10-11', t).escenarios.map((e) => e.tipo)).toEqual([
      'base',
      'contado_hoy',
    ]);
    expect(() => generarEscenarios(0, '2026-10-11', null, t)).toThrow(ErrorDominio);
    expect(() => generarEscenarios(100, '2026-10-11', null, t, 1)).toThrow(ErrorDominio);
  });
});

describe('E8.5 compararEscenarios (E8-22)', () => {
  const v = e8.escenarios['E8-22_comparar_escenarios'];
  const entrada = { ...v.entrada, tarjetas: v.entrada.tarjetas.map(aTarjeta) };

  it(`${v.id} · tenis de $1,500: < 1 %, 79 %, 89 %, 90 % y se recomienda MSI`, () => {
    const r = compararEscenarios(entrada);
    if (r.estado !== 'ok') throw new Error('estado inesperado');
    const { estado, horizontes, ...resto } = r;
    expect(estado).toBe('ok');
    expect(resto).toEqual(v.esperado);
    expect(horizontes).toHaveLength(r.horizontes_usados);
    expect(r.resultados.map((x) => x.porcentaje)).toEqual(['90 %', '< 1 %', '79 %', '89 %']);
  });

  it('por bloques da lo mismo que de una sola vez', () => {
    const paso = crearComparacion(entrada);
    let vueltas = 0;
    while (!paso.avanzar(1234)) vueltas++;
    expect(vueltas).toBeGreaterThan(10);
    expect(paso.resultado()).toEqual(compararEscenarios(entrada));
  });

  it('desempate: a ≤ 2 puntos gana contado, luego esperar, luego la fecha más cercana', () => {
    // Historial en 0: todos los escenarios llegan siempre → empate perfecto.
    const ceros = historialSintetico(30, [0]);
    const base = { ...entrada, historial: ceros, excedente_inicial: 10_000_000 };
    expect(compararEscenarios(base)).toMatchObject({ recomendado: { tipo: 'contado_hoy' } });
    const sinContado = { ...base, escenarios: base.escenarios.filter((e) => e.tipo !== 'contado_hoy') };
    expect(compararEscenarios(sinContado)).toMatchObject({ recomendado: { tipo: 'esperar' } });
    const dosEsperas: Escenario[] = [
      { tipo: 'base' },
      { tipo: 'esperar', precio: 150000, fecha: '2026-10-20' },
      { tipo: 'esperar', precio: 150000, fecha: '2026-10-15' },
    ];
    expect(compararEscenarios({ ...base, escenarios: dosEsperas })).toMatchObject({
      recomendado: { tipo: 'esperar', fecha: '2026-10-15' },
    });
  });

  it('ventana ≤ 62 días usa N = 10 000; cargos después del tope de 24 meses marcan "parcial"', () => {
    const corto: Escenario[] = [{ tipo: 'base' }, { tipo: 'contado_hoy', precio: 100 }];
    const r = compararEscenarios({ ...entrada, escenarios: corto });
    expect(r).toMatchObject({ n: 10000, horizontes_usados: 2 });
    const variable = compararEscenarios({
      ...entrada,
      regla_ingreso: null,
      escenarios: [{ tipo: 'base' }, { tipo: 'esperar', precio: 100, fecha: '2027-03-01' }],
    });
    if (variable.estado !== 'ok') throw new Error('estado inesperado');
    expect(variable.resultados[1]?.parcial).toBe(true);
    expect(variable.horizontes_usados).toBe(1);
  });

  it('sin escenario de compra o con historial corto', () => {
    expect(() => compararEscenarios({ ...entrada, escenarios: [{ tipo: 'base' }] })).toThrow(ErrorDominio);
    expect(compararEscenarios({ ...entrada, historial: entrada.historial.slice(0, 13) })).toEqual({
      estado: 'datos_insuficientes',
    });
    const paso = crearComparacion({ ...entrada, historial: entrada.historial.slice(0, 13) });
    expect(paso.total).toBe(0);
    expect(paso.avanzar(10)).toBe(true);
  });

  it('un escenario MSI sin su tarjeta es un error', () => {
    expect(() =>
      compararEscenarios({
        ...entrada,
        escenarios: [{ tipo: 'base' }, { tipo: 'msi', precio: 1000, meses: 3, tarjeta: 'no_existe' }],
      }),
    ).toThrow(ErrorDominio);
  });
});

describe('E8.6 calibración', () => {
  it('Brier = promedio de (p − resultado)²', () => {
    expect(brier([])).toBeNull();
    expect(brier([{ probabilidad_bp: 10000, resultado: true }])).toBe(0);
    expect(brier([{ probabilidad_bp: 0, resultado: true }])).toBe(1);
    expect(
      brier([
        { probabilidad_bp: 8000, resultado: true },
        { probabilidad_bp: 6000, resultado: false },
      ]),
    ).toBeCloseTo((0.04 + 0.36) / 2, 12);
    expect(() => brier([{ probabilidad_bp: 10001, resultado: true }])).toThrow(ErrorDominio);
  });

  it('probabilidad en puntos base, mitad hacia arriba', () => {
    expect(probabilidadBp(4449, 5000)).toBe(8898);
    expect(probabilidadBp(1, 20000)).toBe(1); // 0.5 bp → 1
    expect(probabilidadBp(0, 10)).toBe(0);
    expect(probabilidadBp(10, 10)).toBe(10000);
    expect(() => probabilidadBp(11, 10)).toThrow(ErrorDominio);
    expect(() => probabilidadBp(1, 0)).toThrow(ErrorDominio);
  });
});
