import { describe, expect, it } from 'vitest';
import * as T from './textos';

/** Consejos, juicios, exclamaciones y tecnicismos (`02 §14`, `08 §1`), como en `observaciones-textos`. */
const PROHIBIDAS =
  /[!¡]|deber[ií]as|\bdebes\b|ahorr|recomend|\bmejor\b|\bpeor\b|por favor|exitosamente|felicidades|bien hecho|\bcuidado\b|\bojo\b|\bevita\b|\breduce\b|\bgasta menos\b|\bpasivos?\b|\bactivos?\b|\basientos?\b|transacci[oó]n|\busted\b/i;

const PROXIMO = { concepto: 'quincena', etiqueta: 'jue 15' };

/** Todas las frases que puede decir el asistente con valores de ejemplo. */
const FRASES: readonly string[] = [
  ...(Object.values(T) as unknown[]).filter((v): v is string => typeof v === 'string'),
  T.etiquetaPildoraDia('Hoy puedes gastar · hasta el jue 15', 'doscientos catorce pesos'),
  T.textoPildoraDia({
    estado: 'normal',
    estadoHorizonte: 'normal',
    proximoIngreso: { concepto: 'quincena', etiqueta: 'jue 15', fecha: '2026-10-15' },
    faltante: 0,
  }),
  T.textoHastaIngreso({
    estadoHorizonte: 'normal',
    proximoIngreso: { concepto: 'quincena', etiqueta: 'jue 15', fecha: '2026-10-15' },
    dias: 4,
  }) ?? '',
  T.textoFaltanteHoy('$374', 'jue 15'),
  T.saludoPorHora(8),
  T.tituloRegistro(false),
  T.tituloRegistro(true),
  T.etiquetaChipRegistro('Categoría', 'Antojos'),
  T.pistaCorregirRegistro('la Nu'),
  T.pistaCorregirRegistro(null),
  T.tituloEsperarIngreso('vie 30', 'quincena'),
  T.textoTeQuedanLibres('$575'),
  T.btnRecuerdamelo('vie 30'),
  T.textoRecordatorioListo('vie 30'),
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
    expect(T.textoNoEntendi('los 300 del Beto')).toBe('Oí «los 300 del Beto». ¿Cuál de estas es?');
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
    ).toBe('Te alcanza. Si compras unos tenis de $500 hoy, tu día pasa de $214 a $89 hasta el jue 15.');
    expect(
      T.textoPuedoGastar({
        titulo: null,
        monto: '$80',
        antes: '$214',
        despues: '$214',
        faltante: null,
        proximo: null,
      }),
    ).toBe('Te alcanza. Si gastas $80 hoy, tu día sigue en $214.');
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
      'No te alcanza. Si gastas $12,000 hoy, te faltarían $11,144 para cubrir lo que viene antes del jue 15.',
    );
  });

  it('TalkBack: la píldora del día dice la cifra en palabras, sin «$» ni dígitos', () => {
    const e = T.etiquetaPildoraDia('Hoy te faltan $374', 'cero pesos');
    expect(e).toBe('Hoy te faltan trescientos setenta y cuatro pesos: cero pesos');
    expect(e).not.toMatch(/\$\d/);
  });
});
