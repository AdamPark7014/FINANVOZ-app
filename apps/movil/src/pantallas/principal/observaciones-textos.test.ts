import { describe, expect, it } from 'vitest';
import type { Observacion } from '../../servicios';
import {
  BTN_YA_LO_VI,
  contextoCifraObservacion,
  etiquetaObservacion,
  PISTA_VER_MOVIMIENTOS_OBSERVACION,
  PISTA_YA_LO_VI,
  textoObservacion,
  TITULO_OBSERVACIONES,
} from './observaciones-textos';

const base = { filtro: null, relevancia: 1 } as const;

/** Una de cada tipo (`02 §4.3`), con las cifras de los ejemplos de la especificación. */
const MUESTRAS: Observacion[] = [
  {
    ...base,
    tipo: 'comparativa',
    clave: 'comparativa:comida_fuera:2026-09-30',
    cifra: 124_000,
    categoria: 'comida_fuera',
    nombreCategoria: 'comida fuera',
    actual: 124_000,
    anterior: 98_000,
    periodo: { inicio: '2026-09-30', concepto: 'quincena' },
  },
  {
    ...base,
    tipo: 'comparativa',
    clave: 'comparativa:super:2026-10-01',
    cifra: 70_000,
    categoria: 'super',
    nombreCategoria: 'súper',
    actual: 70_000,
    anterior: 100_000,
    periodo: { inicio: '2026-10-01', concepto: null },
  },
  {
    ...base,
    tipo: 'inusual',
    clave: 'inusual:t1',
    cifra: 185_000,
    transaccionId: 't1',
    categoria: 'ropa',
    nombreCategoria: 'ropa',
    monto: 185_000,
    fecha: '2026-10-10',
    cuando: 'ayer',
    mediana: 50_000,
  },
  {
    ...base,
    tipo: 'doble',
    clave: 'doble:a:b',
    cifra: 24_900,
    transacciones: ['a', 'b'],
    monto: 24_900,
    fecha: '2026-10-11',
    cuando: 'hoy',
    etiquetaFecha: 'dom 11',
    comercio: 'Netflix',
    descripcion: null,
  },
  {
    ...base,
    tipo: 'doble',
    clave: 'doble:c:d',
    cifra: 8_000,
    transacciones: ['c', 'd'],
    monto: 8_000,
    fecha: '2026-10-06',
    cuando: 'otro',
    etiquetaFecha: 'mar 6',
    comercio: null,
    descripcion: 'tacos',
  },
  {
    ...base,
    tipo: 'ritmo',
    clave: 'ritmo:2026-09-30',
    cifra: 234_000,
    periodo: { inicio: '2026-09-30', concepto: 'quincena' },
    porcentajeDias: 30,
    porcentajeGastado: 55,
    gastado: 234_000,
    libreInicial: 425_000,
    diasTranscurridos: 5,
    diasTotales: 15,
  },
  {
    ...base,
    tipo: 'suscripciones',
    clave: 'suscripciones:2026-10',
    cifra: 34_800,
    mes: '2026-10',
    total: 34_800,
    cantidad: 2,
  },
];

/** Consejos, juicios, exclamaciones y tecnicismos (`02 §14`, `08 §1`). */
const PROHIBIDAS =
  /[!¡]|deber[ií]as|\bdebes\b|ahorr|recomend|\bmejor\b|\bpeor\b|por favor|exitosamente|felicidades|bien hecho|\bcuidado\b|\bojo\b|\bevita\b|\breduce\b|\bgasta menos\b|\bpasivos?\b|\bactivos?\b|\basientos?\b|transacci[oó]n|\busted\b/i;

describe('principal/observaciones-textos · redacción (`02 §4.3`)', () => {
  it('reproduce las frases de la especificación', () => {
    expect(MUESTRAS.map(textoObservacion)).toEqual([
      'Llevas $1,240 en comida fuera; a estas alturas de tu quincena anterior llevabas $980.',
      'Llevas $700 en súper; a estas alturas del mes pasado llevabas $1,000.',
      'Los $1,850 en ropa de ayer fueron más de lo normal en esa categoría.',
      'Hay dos cargos iguales de $249 en Netflix hoy.',
      'Hay dos gastos iguales de $80 («tacos») el mar 6.',
      'Va el 30 % de tu quincena y llevas el 55 % de lo libre ($2,340).',
      'Este mes van $348 en 2 suscripciones.',
    ]);
  });

  it('ninguna frase ni botón da consejos, felicita, exclama ni usa tecnicismos', () => {
    const textos = [
      TITULO_OBSERVACIONES,
      BTN_YA_LO_VI,
      PISTA_YA_LO_VI,
      PISTA_VER_MOVIMIENTOS_OBSERVACION,
      ...MUESTRAS.map(textoObservacion),
      ...MUESTRAS.map(contextoCifraObservacion),
    ];
    for (const t of textos) expect(t).not.toMatch(PROHIBIDAS);
  });

  it('TalkBack: título más la frase con las cifras en palabras, sin «$» ni dígitos de dinero', () => {
    for (const o of MUESTRAS) {
      const etiqueta = etiquetaObservacion(o);
      expect(etiqueta.startsWith(`${TITULO_OBSERVACIONES}. `)).toBe(true);
      expect(etiqueta).not.toMatch(/\$\d/);
      expect(etiqueta).toMatch(/pesos/);
    }
    expect(etiquetaObservacion(MUESTRAS[3] as Observacion)).toBe(
      'Lo que veo. Hay dos cargos iguales de doscientos cuarenta y nueve pesos en Netflix hoy.',
    );
  });

  it('el contexto de la cifra nombra lo que mide', () => {
    expect(MUESTRAS.map(contextoCifraObservacion)).toEqual([
      'Comida fuera en este periodo',
      'Súper en este periodo',
      'Gasto en ropa',
      'Cargo repetido',
      'Cargo repetido',
      'Gastado de lo libre',
      'Suscripciones este mes',
    ]);
  });
});
