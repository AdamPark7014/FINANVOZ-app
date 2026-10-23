import { describe, expect, it } from 'vitest';
import * as T from './textos';

/** Consejos, juicios, exclamaciones y tecnicismos (`02 §14`, `08 §1`), como en `observaciones-textos`. */
const PROHIBIDAS =
  /[!¡]|deber[ií]as|\bdebes\b|ahorr|recomend|\bmejor\b|\bpeor\b|por favor|exitosamente|felicidades|bien hecho|\bcuidado\b|\bojo\b|\bevita\b|\breduce\b|\bgasta menos\b|\bpasivos?\b|\bactivos?\b|\basientos?\b|transacci[oó]n|\busted\b/i;

const PROXIMO = { concepto: 'quincena', etiqueta: 'jue 15' };

/** Todas las frases que puede decir el asistente con valores de ejemplo. */
const FRASES: readonly string[] = [
  ...(Object.values(T) as unknown[]).filter((v): v is string => typeof v === 'string'),
  T.etiquetaBarraDia(317_400, 20_000, 85_600),
  T.valorCuando('Dom 11 oct', 'hoy'),
  T.valorCuando('Sáb 10 oct', 'ayer'),
  T.pistaDecirSi('Nu ••4410'),
  T.pistaDecirSi(null),
  T.tituloEntendiDe('¿Cambio tu ingreso?'),
  T.etiquetaTurnoPersona('tacos 80 en efectivo', true),
  T.textoNoEntendi('los 300 del Beto'),
  T.textoEstoOiR2('pagué la luz 450 con la BBVA'),
  T.btnLoCompreA('A 3 MSI con la Oro'),
  T.lineaEscenario('Hoy, de contado', '87 %'),
  T.textoComparaHoy(true, '$214'),
  T.textoComparaHoy(false, '$214'),
  T.textoPuedoGastar({
    titulo: 'Unos tenis de $500',
    monto: '$500',
    antes: '$214',
    despues: '$89',
    faltante: null,
    proximo: PROXIMO,
  }),
  T.textoPuedoGastar({
    titulo: null,
    monto: '$12,000',
    antes: '$214',
    despues: '$0',
    faltante: '$11,144',
    proximo: null,
  }),
  T.saludoDelDia('$214'),
  T.saludoDelDia(null),
];

describe('asistente/textos · redacción (Ola 7 §1.4)', () => {
  it('ninguna frase da consejos, juzga, exclama ni usa tecnicismos', () => {
    for (const f of FRASES) expect(f).not.toMatch(PROHIBIDAS);
  });

  it('cada frase cabe en dos líneas de turno (≤ 140 caracteres)', () => {
    for (const f of FRASES) expect(f.length).toBeLessThanOrEqual(140);
  });

  it('reproduce las frases de las maquetas', () => {
    expect(T.TITULO_ENTENDI_REGISTRO).toBe('Entendí · ¿lo registro?');
    expect(T.BTN_SI_REGISTRALO).toBe('Sí, regístralo');
    expect(T.pistaDecirSi('la Nu')).toBe('También puedes decir «sí» o «no, fue con la Nu».');
    expect(T.textoNoEntendi('los 300 del Beto')).toBe('Oí «los 300 del Beto», pero no supe qué pasó.');
    expect(T.BTN_CORREGIR_OIDO).toBe('Corregir lo que oí');
    expect(T.valorCuando('Dom 11 oct', 'hoy')).toBe('Hoy, dom 11 oct');
    expect(T.tituloEntendiDe('¿Ajusto el saldo?')).toBe('Entendí · ¿ajusto el saldo?');
  });

  it('«¿Puedo gastar?» describe qué pasa con tu dinero', () => {
    expect(
      T.textoPuedoGastar({
        titulo: 'Unos tenis de $500',
        monto: '$500',
        antes: '$214',
        despues: '$89',
        faltante: null,
        proximo: PROXIMO,
      }),
    ).toBe('Si compras unos tenis de $500 hoy, tu día pasa de $214 a $89 hasta tu quincena (jue 15).');
    expect(
      T.textoPuedoGastar({
        titulo: null,
        monto: '$80',
        antes: '$214',
        despues: '$214',
        faltante: null,
        proximo: null,
      }),
    ).toBe('Si gastas $80 hoy, tu día sigue en $214.');
    expect(
      T.textoPuedoGastar({
        titulo: null,
        monto: '$12,000',
        antes: '$214',
        despues: '$0',
        faltante: '$11,144',
        proximo: PROXIMO,
      }),
    ).toBe(
      'Si gastas $12,000 hoy, te faltarían $11,144 para cubrir lo que viene antes de tu quincena (jue 15).',
    );
  });

  it('TalkBack: la barra del día dice las tres cifras en palabras, sin «$» ni dígitos', () => {
    const e = T.etiquetaBarraDia(317_400, 20_000, 85_600);
    expect(e).toMatch(/^Reservado tres mil ciento setenta y cuatro pesos/);
    expect(e).not.toMatch(/\$\d/);
  });
});
