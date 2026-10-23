import { describe, expect, it } from 'vitest';
import type { IdFlujo } from '../tipos';
import { elegir, leerEntero, leerFecha, leerMonto, siONo } from './comun';
import { FLUJOS, flujoDeResultado, iniciarFlujo, responderPaso, siguientePregunta } from './index';
import { dejarPrellenado, tomarPrellenado } from './prellenado';
import * as T from './textos';
import { chip, conEscenario, dicho, monto } from './__pruebas__/base';

const IDS: readonly IdFlujo[] = ['tarjeta', 'msi', 'tanda', 'cuenta_dividida', 'arqueo', 'pagar_tarjeta'];

describe('flujos · registro y contrato', () => {
  it('los seis flujos están registrados con su id y pasos con ids únicos', () => {
    expect(Object.keys(FLUJOS).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      const f = FLUJOS[id];
      expect(f.id).toBe(id);
      const pasos = f.pasos.map((p) => p.id);
      expect(new Set(pasos).size).toBe(pasos.length);
    }
  });

  it('`flujoDeResultado` dice qué flujo abre cada resultado de registrarTexto', () => {
    expect(flujoDeResultado({ resultado: 'tarjeta_por_agregar' })).toBe('tarjeta');
    expect(flujoDeResultado({ resultado: 'confirmar_msi' })).toBe('msi');
    expect(flujoDeResultado({ resultado: 'tanda_por_crear' })).toBe('tanda');
    expect(flujoDeResultado({ resultado: 'confirmar_division' })).toBe('cuenta_dividida');
    expect(flujoDeResultado({ resultado: 'arqueo' })).toBe('arqueo');
    expect(flujoDeResultado({ resultado: 'registrado' })).toBeNull();
    expect(flujoDeResultado(null)).toBeNull();
  });

  it('`iniciarFlujo` arma el estado; un paso que ya no existe es un error en la misma pregunta', () => {
    const p = conEscenario('e4-01');
    const r = iniciarFlujo('tanda', p.ctx, null);
    if (!('flujo' in r)) throw new Error(r.noDisponible);
    const q = siguientePregunta(r.flujo, r.estado);
    expect(q).toMatchObject({ paso: 'aportacion', texto: T.PREGUNTA_APORTACION, campo: 'monto', chips: [] });
    expect(q).not.toHaveProperty('ayuda');
    expect(responderPaso(r.flujo, r.estado, 'no_existe', monto(100))).toEqual({ error: T.ERROR_PASO });
  });

  it('el prellenado se toma una sola vez', () => {
    dejarPrellenado('arqueo', { efectivoReal: 30_000, marcados: [] });
    expect(tomarPrellenado('arqueo')).toEqual({ efectivoReal: 30_000, marcados: [] });
    expect(tomarPrellenado('arqueo')).toBeNull();
  });
});

describe('flujos · leer respuestas', () => {
  it('montos: campo, chip con centavos y lo dicho; cero solo si se admite', () => {
    expect(leerMonto(monto(32_000, true), false)).toEqual({ centavos: 32_000, aproximado: true });
    expect(leerMonto(chip('0'), true)).toEqual({ centavos: 0, aproximado: false });
    expect(leerMonto(chip('0'), false)).toBeNull();
    expect(leerMonto(chip(''), true)).toBeNull();
    expect(leerMonto(dicho('como tres mil doscientos'), false)).toEqual({
      centavos: 320_000,
      aproximado: true,
    });
    expect(leerMonto(dicho('nada'), true)).toEqual({ centavos: 0, aproximado: false });
    expect(leerMonto(dicho('ni idea'), true)).toBeNull();
  });

  it('enteros y sí/no dichos', () => {
    expect(leerEntero(dicho('somos 10'), 2, 50)).toBe(10);
    expect(leerEntero(dicho('éramos tres'), 2, 50)).toBe(3);
    expect(leerEntero(chip('60'), 2, 50)).toBeNull();
    expect(siONo('Sí, completa')).toBe(true);
    expect(siONo('no, una parte')).toBe(false);
    expect(siONo('a veces')).toBeNull();
  });

  it('elegir un chip por su etiqueta dicha: única coincidencia o nada', () => {
    const chips = [
      { valor: 'a', etiqueta: 'BBVA Débito ••5521' },
      { valor: 'b', etiqueta: 'Cartera' },
      { valor: 'c', etiqueta: 'BBVA Azul ••1022' },
    ];
    expect(elegir(dicho('la cartera'), chips)).toBe('b');
    expect(elegir(dicho('azul'), chips)).toBe('c');
    expect(elegir(dicho('bbva'), chips)).toBeNull();
    expect(elegir(chip('z'), chips)).toBeNull();
  });

  it('fechas dichas o escritas, siempre civiles', () => {
    const hoy = '2026-10-11';
    expect(leerFecha('hoy', hoy)).toBe(hoy);
    expect(leerFecha('mañana', hoy)).toBe('2026-10-12');
    expect(leerFecha('el 15', hoy)).toBe('2026-10-15');
    expect(leerFecha('15 de noviembre', hoy)).toBe('2026-11-15');
    expect(leerFecha('16/10', hoy)).toBe('2026-10-16');
    expect(leerFecha('15/09/2026', hoy)).toBe('2026-09-15');
    expect(leerFecha('2026-12-31', hoy)).toBe('2026-12-31');
    expect(leerFecha('31/02/2026', hoy)).toBeNull();
    expect(leerFecha('el día que sea', hoy)).toBeNull();
  });
});

/** Tono de `02 §14`: sin exclamaciones, sin consejos, sin tecnicismos contables, tuteo. */
const PROHIBIDAS =
  /[!¡]|recomend|\bmejor\b|\bpeor\b|ahorr|por favor|exitosamente|felicidades|\bcuidado\b|\bojo\b|\bevita\b|\bpasivos?\b|\basientos?\b|transacci[oó]n|\busted\b|\bsu cuenta\b/i;

describe('flujos · redacción', () => {
  it('ningún texto de los flujos tiene exclamaciones, consejos ni tecnicismos', () => {
    const textos: string[] = [];
    for (const v of Object.values(T)) {
      if (typeof v === 'string') textos.push(v);
      else if (typeof v === 'object') textos.push(...Object.values(v as Record<string, string>));
      else if (typeof v === 'function') {
        const f = v as (...a: unknown[]) => unknown;
        // Cifras, nombres y fechas de muestra: la primera combinación que la función acepte.
        for (const args of [
          [12_345, 2, 3],
          [12_345, '2026-11-18'],
          ['2026-11-18', '2026-10-11'],
        ]) {
          try {
            const muestra = f(...args);
            if (typeof muestra === 'string') textos.push(muestra);
            break;
          } catch {
            // Siguiente combinación.
          }
        }
      }
    }
    textos.push(T.valorCiclo(28, 18, null), T.valorCiclo(10, null, 20), T.fechaCorta('2026-11-18'));
    expect(textos.length).toBeGreaterThan(80);
    for (const t of textos) expect(t).not.toMatch(PROHIBIDAS);
  });
});
