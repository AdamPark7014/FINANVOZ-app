import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluarReparacion, revisarOpciones } from '../eval/evaluar-reparacion';
import { cargarContexto, cargarGoldenReparacion } from '../eval/fixtures';
import { interpretarReglas } from '../reglas';
import { MAX_OPCIONES_REPARACION, sugerirReparacion, TIPOS_REPARACION } from './reparacion';

const { contexto } = cargarContexto();
const golden = cargarGoldenReparacion();

const proyectar = (texto: string, ctx = contexto) =>
  sugerirReparacion(texto, ctx).map((o) => ({
    tipo: o.tipo,
    ...(o.frase !== undefined ? { frase: o.frase } : {}),
  }));

describe('golden de reparación (Ola 7 §3, CA-O7 3)', () => {
  for (const caso of golden) {
    it(`${caso.id}${caso.nota ? ` · ${caso.nota}` : ''}`, () => {
      expect(proyectar(caso.texto)).toEqual(caso.esperado);
      expect(revisarOpciones(sugerirReparacion(caso.texto, contexto), caso.texto, contexto)).toEqual([]);
    });
  }

  it('al 100 %, con al menos 30 frases que el nivel 0 no entiende', () => {
    expect(evaluarReparacion(golden, contexto).aprobado).toBe(true);
    expect(golden.length).toBeGreaterThanOrEqual(40);
    // Desde el 23-10 el nivel 0 contesta 6 de estas frases sin la nube (fuera de alcance, sueldo bruto, «pagué la
    // tarjeta» sin monto, «la semana pasada»: `reglas/sin-nube.ts`) y desde el 26-10 otras 15 (darle dinero a alguien,
    // honorarios, «cooperé con», chelas, gas, «X para el perro», «dos cincuenta», el enganche: 06 §9.3). La reparación
    // se sigue probando con las 52: sirve cuando la nube contesta `no_entendi`.
    const contestadas = golden.filter(
      (c) => c.texto.trim() !== '' && interpretarReglas(c.texto, contexto) !== null,
    );
    expect(contestadas.map((c) => c.id).sort()).toEqual([
      'REP04',
      'REP08',
      'REP09',
      'REP17',
      'REP20',
      'REP22',
      'REP27',
      'REP28',
      'REP33',
      'REP34',
      'REP35',
      'REP36',
      'REP37',
      'REP38',
      'REP39',
      'REP40',
      'REP43',
      'REP44',
      'REP47',
      'REP48',
      'REP51',
    ]);
    expect(golden.length - 1 - contestadas.length).toBeGreaterThanOrEqual(30);
    expect(new Set(golden.map((c) => c.id)).size).toBe(golden.length);
  });

  it('el golden ejercita los siete tipos y frases en seis de ellos', () => {
    const tipos = new Set(golden.flatMap((c) => c.esperado.map((o) => o.tipo)));
    expect(tipos).toEqual(new Set(TIPOS_REPARACION));
    const conFrase = new Set(golden.flatMap((c) => c.esperado.filter((o) => o.frase).map((o) => o.tipo)));
    expect(conFrase).toEqual(new Set(TIPOS_REPARACION.filter((t) => t !== 'otra')));
  });
});

describe('sugerirReparacion', () => {
  it('«los 300 del Beto» → le presté / me pagó, con el monto para el formulario', () => {
    const opciones = sugerirReparacion('los 300 del Beto', contexto);
    expect(opciones.slice(0, 2)).toEqual([
      { tipo: 'prestamo', frase: 'le presté 300 a Beto', monto: 30000 },
      { tipo: 'me_pagaron', frase: 'el Beto me pagó 300 de lo que me debía', monto: 30000 },
    ]);
    expect(opciones.at(-1)).toEqual({ tipo: 'otra' });
  });

  it('cada frase la entiende el nivel 0 como ese movimiento, con ese monto', () => {
    const movimiento = {
      gasto: 'gasto',
      ingreso: 'ingreso',
      prestamo: 'prestamo_otorgado',
      me_pagaron: 'cobro_prestamo',
      pago_tarjeta: 'pago_tarjeta',
      transferencia: 'transferencia',
    } as const;
    for (const caso of golden) {
      for (const o of sugerirReparacion(caso.texto, contexto)) {
        if (o.tipo === 'otra' || o.frase === undefined) continue;
        const i = interpretarReglas(o.frase, contexto);
        expect(i?.intencion).toBe('registrar');
        if (i?.intencion !== 'registrar') continue;
        expect(i.movimientos).toHaveLength(1);
        expect(i.movimientos[0]).toMatchObject({ tipo: movimiento[o.tipo], monto: o.monto });
      }
    }
  });

  it('sin contexto también sugiere, y las frases no inventan cuentas', () => {
    expect(proyectar('los 300 del Beto', undefined)).toEqual(golden.find((c) => c.id === 'REP01')?.esperado);
    const nu = sugerirReparacion('300 de la Nu');
    expect(nu.map((o) => o.tipo)).toEqual(['gasto', 'ingreso', 'otra']);
    expect(nu.every((o) => !o.frase?.includes('Nu'))).toBe(true);
  });

  it('una cifra ambigua no deja monto ni frase', () => {
    const opciones = sugerirReparacion('me salió en dos cincuenta el estacionamiento', contexto);
    expect(opciones.every((o) => o.monto === undefined && o.frase === undefined)).toBe(true);
  });

  it('nada oído, nada que sugerir', () => {
    expect(sugerirReparacion('', contexto)).toEqual([]);
    expect(sugerirReparacion(' , ', contexto)).toEqual([]);
  });

  it('determinista: la misma frase y el mismo contexto dan lo mismo', () => {
    for (const caso of golden.slice(0, 10)) {
      expect(sugerirReparacion(caso.texto, contexto)).toEqual(sugerirReparacion(caso.texto, contexto));
    }
  });

  it('cualquier frase: de 3 a 4 opciones distintas, «otra» al final y frases que el nivel 0 entiende', () => {
    const palabras = fc.constantFrom(
      'los',
      '300',
      'del',
      'Beto',
      'me',
      'le',
      'pagó',
      'di',
      'la',
      'Nu',
      'de',
      'BBVA',
      'a',
      'Mercado',
      'Pago',
      'tacos',
      'ayer',
      'en',
      'efectivo',
      'mi',
      'primo',
      ',',
      'y',
      'debe',
      'pasé',
    );
    fc.assert(
      fc.property(fc.array(palabras, { minLength: 1, maxLength: 7 }), (ps) => {
        const texto = ps.join(' ');
        const opciones = sugerirReparacion(texto, contexto);
        if (texto.replace(/[ ,]/g, '') === '') return;
        expect(opciones.length).toBeLessThanOrEqual(MAX_OPCIONES_REPARACION);
        expect(revisarOpciones(opciones, texto, contexto)).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});
