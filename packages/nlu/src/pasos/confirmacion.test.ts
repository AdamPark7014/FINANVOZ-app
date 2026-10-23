import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluarConfirmacion } from '../eval/evaluar-confirmacion';
import { cargarContexto, cargarGoldenConfirmacion } from '../eval/fixtures';
import { EsquemaLecturaConfirmacion, leerConfirmacion, type ContextoConfirmacion } from './confirmacion';

const { contexto } = cargarContexto();
const golden = cargarGoldenConfirmacion();

describe('golden de confirmación por voz (Ola 7 §4)', () => {
  for (const caso of golden) {
    it(`${caso.id}${caso.nota ? ` · ${caso.nota}` : ''}`, () => {
      expect(leerConfirmacion(caso.texto, { ...contexto, ...caso.tarjeta })).toEqual(caso.esperado);
    });
  }

  it('cobertura y precisión al 100 %, con al menos 60 frases y ambiguas que dan null', () => {
    const r = evaluarConfirmacion(golden, contexto);
    expect(r.aprobado).toBe(true);
    expect(golden.length).toBeGreaterThanOrEqual(60);
    const tipos = golden.map((c) => (c.esperado === null ? 'null' : String(c.esperado.tipo)));
    for (const tipo of ['si', 'no', 'cambio', 'null'])
      expect(tipos.filter((t) => t === tipo).length).toBeGreaterThan(5);
    expect(new Set(golden.map((c) => c.id)).size).toBe(golden.length);
  });

  it('el golden cubre las cuatro filas', () => {
    const filas = golden.flatMap((c) =>
      c.esperado?.tipo === 'cambio' ? (c.esperado.cambios as { fila: string }[]).map((x) => x.fila) : [],
    );
    expect(new Set(filas)).toEqual(new Set(['monto', 'cuenta', 'categoria', 'cuando']));
  });
});

describe('leerConfirmacion · contexto', () => {
  it('sin contexto lee sí, no, montos, categorías y cuentas genéricas, pero no alias ni fechas', () => {
    expect(leerConfirmacion('sí')).toEqual({ tipo: 'si' });
    expect(leerConfirmacion('nel')).toEqual({ tipo: 'no' });
    expect(leerConfirmacion('eran 40')).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'monto', monto: 4000, aproximado: false }],
    });
    expect(leerConfirmacion('fue en efectivo')).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'cuenta', cuenta: { tipo: 'efectivo' } }],
    });
    expect(leerConfirmacion('ponle antojos')).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'categoria', categoria: 'antojos' }],
    });
    expect(leerConfirmacion('no, fue con la Nu')).toBeNull();
    expect(leerConfirmacion('fue ayer')).toBeNull();
  });

  it('la fecha sale del contexto, nunca del reloj', () => {
    const lunes: ContextoConfirmacion = { fecha_referencia: '2026-03-02' };
    expect(leerConfirmacion('fue ayer', lunes)).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'cuando', fecha: '2026-03-01' }],
    });
    expect(leerConfirmacion('fue el viernes', lunes)).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'cuando', fecha: '2026-02-27' }],
    });
    expect(leerConfirmacion('fue el 15', lunes)).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'cuando', fecha: '2026-02-15' }],
    });
  });

  it('un alias que existe como crédito y como débito no se adivina', () => {
    const ambiguo: ContextoConfirmacion = {
      cuentas: [
        { tipo: 'credito', alias: ['azul'] },
        { tipo: 'debito', alias: ['azul'] },
      ],
    };
    expect(leerConfirmacion('no, fue con la azul', ambiguo)).toBeNull();
  });

  it('`filas` deja fuera los cambios a filas que la tarjeta no tiene', () => {
    const soloMonto = { ...contexto, filas: ['monto', 'que'] };
    expect(leerConfirmacion('eran 40', soloMonto)?.tipo).toBe('cambio');
    expect(leerConfirmacion('eran 40 con la Nu', soloMonto)).toBeNull();
    expect(leerConfirmacion('sí', soloMonto)).toEqual({ tipo: 'si' });
  });

  it('`movimiento` acota las categorías: de gasto por omisión, de ingreso en una tarjeta de ingreso', () => {
    expect(leerConfirmacion('ponle ventas', contexto)).toBeNull();
    expect(leerConfirmacion('ponle ventas', { ...contexto, movimiento: 'ingreso' })).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'categoria', categoria: 'ventas' }],
    });
    expect(leerConfirmacion('era regalo recibido', { ...contexto, movimiento: 'ingreso' })).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'categoria', categoria: 'regalo_recibido' }],
    });
    expect(leerConfirmacion('era regalo', contexto)).toEqual({
      tipo: 'cambio',
      cambios: [{ fila: 'categoria', categoria: 'regalos' }],
    });
  });
});

describe('leerConfirmacion · ante la duda, null', () => {
  it.each([
    ['vacío', ''],
    ['solo signos', '¿?'],
    ['una cifra en cero', 'eran 0'],
    ['dos veces la misma fila', 'eran 40 y eran 50'],
    ['un dato y algo que no se entiende', 'eran 40 y no sé qué'],
    ['sí y no juntos', 'sí, no, sí'],
  ])('%s', (_, texto) => {
    expect(leerConfirmacion(texto, contexto)).toBeNull();
  });

  it('nunca truena y toda lectura cumple el esquema', () => {
    const palabras = fc.constantFrom(
      'sí',
      'no',
      'dale',
      ',',
      'pero',
      'eran',
      '40',
      'con',
      'la',
      'Nu',
      'ayer',
      'ponle',
      'comida',
      'y',
      'fue',
      'efectivo',
      'cancela',
      'el',
      'viernes',
    );
    fc.assert(
      fc.property(fc.array(palabras, { maxLength: 8 }), (ps) => {
        const r = leerConfirmacion(ps.join(' '), contexto);
        expect(r === null || EsquemaLecturaConfirmacion.safeParse(r).success).toBe(true);
      }),
    );
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        expect(() => leerConfirmacion(s, contexto)).not.toThrow();
      }),
    );
  });
});

describe('EsquemaLecturaConfirmacion', () => {
  it('rechaza un cambio sin filas o con la misma fila dos veces', () => {
    expect(EsquemaLecturaConfirmacion.safeParse({ tipo: 'cambio', cambios: [] }).success).toBe(false);
    expect(
      EsquemaLecturaConfirmacion.safeParse({
        tipo: 'cambio',
        cambios: [
          { fila: 'monto', monto: 100, aproximado: false },
          { fila: 'monto', monto: 200, aproximado: false },
        ],
      }).success,
    ).toBe(false);
    expect(
      EsquemaLecturaConfirmacion.safeParse({
        tipo: 'cambio',
        cambios: [{ fila: 'cuando', fecha: '2026-02-30' }],
      }).success,
    ).toBe(false);
  });
});
