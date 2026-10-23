import { describe, expect, it } from 'vitest';
import {
  claveVoz,
  elegirVoz,
  faltaVozMejorada,
  normalizarIdioma,
  opcionesVoz,
  ordenarVoces,
  parametrosVoz,
  textoIdioma,
  type VozSistema,
} from './voces';

const voz = (identifier: string, name: string, language: string, quality = 'Default'): VozSistema => ({
  identifier,
  name,
  language,
  quality,
});

/** Un iPhone recién comprado: compactas, Eloquence, una de Siri (no se puede usar) y otras lenguas. */
const IPHONE: readonly VozSistema[] = [
  voz('com.apple.voice.compact.en-US.Samantha', 'Samantha', 'en-US'),
  voz('com.apple.eloquence.es-MX.Eddy', 'Eddy', 'es-MX'),
  voz('com.apple.voice.compact.es-MX.Juan', 'Juan', 'es-MX'),
  voz('com.apple.voice.compact.es-MX.Paulina', 'Paulina', 'es-MX'),
  voz('com.apple.voice.compact.es-ES.Monica', 'Mónica', 'es-ES'),
  voz('com.apple.voice.enhanced.es-ES.Monica', 'Mónica', 'es-ES', 'Enhanced'),
  voz('com.apple.ttsbundle.siri_female_es-MX_compact', 'Siri Voz 1', 'es-MX'),
  voz('com.apple.speech.synthesis.voice.Bells', 'Bells', 'es-MX'),
];
const PAULINA_MEJORADA = voz(
  'com.apple.voice.enhanced.es-MX.Paulina',
  'Paulina (mejorada)',
  'es-MX',
  'Enhanced',
);
const PAULINA_PREMIUM = voz('com.apple.voice.premium.es-MX.Paulina', 'Paulina', 'es-MX');

const IOS = { plataforma: 'ios', enLinea: false } as const;

describe('voz en iPhone', () => {
  it('sin voz mejorada: Paulina compacta (México antes que una mejorada de España); nada de Siri ni Eloquence', () => {
    expect(elegirVoz(IPHONE, IOS)?.identifier).toBe('com.apple.voice.compact.es-MX.Paulina');
    const orden = ordenarVoces(IPHONE, IOS).map((v) => v.identifier);
    expect(orden).not.toContain('com.apple.ttsbundle.siri_female_es-MX_compact');
    expect(orden).not.toContain('com.apple.speech.synthesis.voice.Bells');
    expect(orden).not.toContain('com.apple.voice.compact.en-US.Samantha');
    expect(orden.at(-1)).toBe('com.apple.eloquence.es-MX.Eddy');
  });

  it('premium > mejorada > compacta', () => {
    expect(elegirVoz([...IPHONE, PAULINA_MEJORADA], IOS)?.identifier).toBe(PAULINA_MEJORADA.identifier);
    expect(elegirVoz([...IPHONE, PAULINA_MEJORADA, PAULINA_PREMIUM], IOS)?.identifier).toBe(
      PAULINA_PREMIUM.identifier,
    );
  });

  it('se recuerda la elegida; si luego descargas su versión mejorada, se usa esa', () => {
    expect(elegirVoz(IPHONE, IOS, 'com.apple.voice.compact.es-MX.Juan')?.identifier).toBe(
      'com.apple.voice.compact.es-MX.Juan',
    );
    expect(
      elegirVoz([...IPHONE, PAULINA_MEJORADA], IOS, 'com.apple.voice.compact.es-MX.Paulina')?.identifier,
    ).toBe(PAULINA_MEJORADA.identifier);
    // Si borras la mejorada, vuelve a la compacta de la misma persona; si la voz ya no existe, la mejor.
    expect(elegirVoz(IPHONE, IOS, PAULINA_MEJORADA.identifier)?.identifier).toBe(
      'com.apple.voice.compact.es-MX.Paulina',
    );
    expect(elegirVoz(IPHONE, IOS, 'com.apple.voice.compact.es-AR.Diego')?.identifier).toBe(
      'com.apple.voice.compact.es-MX.Paulina',
    );
  });

  it('Ajustes › Voz: las 3 mejores, una por persona, con su calidad', () => {
    expect(opcionesVoz(IPHONE, IOS)).toEqual([
      {
        id: 'com.apple.voice.compact.es-MX.Paulina',
        etiqueta: 'Paulina',
        descripcion: 'Español de México · básica',
        calidad: 'basica',
        idioma: 'es-MX',
      },
      {
        id: 'com.apple.voice.compact.es-MX.Juan',
        etiqueta: 'Juan',
        descripcion: 'Español de México · básica',
        calidad: 'basica',
        idioma: 'es-MX',
      },
      {
        id: 'com.apple.voice.enhanced.es-ES.Monica',
        etiqueta: 'Mónica (mejorada)',
        descripcion: 'Español de España · mejorada',
        calidad: 'mejorada',
        idioma: 'es-ES',
      },
    ]);
    const conMejorada = opcionesVoz([...IPHONE, PAULINA_MEJORADA], IOS);
    expect(conMejorada[0]).toMatchObject({ id: PAULINA_MEJORADA.identifier, etiqueta: 'Paulina (mejorada)' });
    expect(conMejorada.filter((o) => o.etiqueta.startsWith('Paulina'))).toHaveLength(1);
  });

  it('la guía de «Paulina (mejorada)» solo hace falta en iPhone sin voz mejorada de México', () => {
    expect(faltaVozMejorada(IPHONE, 'ios')).toBe(true);
    expect(faltaVozMejorada([], 'ios')).toBe(true);
    expect(faltaVozMejorada([...IPHONE, PAULINA_MEJORADA], 'ios')).toBe(false);
    expect(faltaVozMejorada([...IPHONE, PAULINA_PREMIUM], 'ios')).toBe(false);
    expect(faltaVozMejorada(IPHONE, 'android')).toBe(false);
  });
});

const google = (identifier: string, quality = 'Enhanced'): VozSistema => {
  const region = (/^es-(\w\w)/i.exec(identifier)?.[1] ?? 'us').toUpperCase();
  return voz(identifier, identifier, `es-${region}`, quality);
};

/** Google Text-to-Speech: cada voz en versión de red y local, más la pseudo-voz de la región. */
const ANDROID: readonly VozSistema[] = [
  google('es-es-x-eea-network'),
  google('es-es-x-eea-local'),
  google('es-us-x-esd-network'),
  google('es-us-x-esd-local'),
  google('es-us-x-esf-local', 'Default'),
  google('es-us-x-sfb-network'),
  google('es-us-x-sfb-local'),
  google('es-US-language', 'Default'),
  voz('en-us-x-iob-network', 'en-us-x-iob-network', 'en-US', 'Enhanced'),
];

const EN_LINEA = { plataforma: 'android', enLinea: true } as const;
const SIN_RED = { plataforma: 'android', enLinea: false } as const;

describe('voz en Android', () => {
  it('con internet, la voz de red de Google; sin internet, su versión local', () => {
    expect(elegirVoz(ANDROID, EN_LINEA)?.identifier).toBe('es-us-x-sfb-network');
    expect(elegirVoz(ANDROID, SIN_RED)?.identifier).toBe('es-us-x-sfb-local');
    expect(ordenarVoces(ANDROID, SIN_RED).some((v) => v.identifier.endsWith('-network'))).toBe(false);
  });

  it('la elegida se guarda sin el sufijo y se usa la versión que toque', () => {
    expect(claveVoz(google('es-us-x-esd-network'), 'android')).toBe('es-us-x-esd');
    expect(elegirVoz(ANDROID, EN_LINEA, 'es-us-x-esd')?.identifier).toBe('es-us-x-esd-network');
    expect(elegirVoz(ANDROID, SIN_RED, 'es-us-x-esd')?.identifier).toBe('es-us-x-esd-local');
  });

  it('México y Estados Unidos juntos: con red gana la de red; sin red, la de México', () => {
    const conMexico = [...ANDROID, voz('es-MX-SMTf00', 'es-MX-SMTf00', 'es-MX', 'Enhanced')];
    expect(elegirVoz(conMexico, EN_LINEA)?.identifier).toBe('es-us-x-sfb-network');
    expect(elegirVoz(conMexico, SIN_RED)?.identifier).toBe('es-MX-SMTf00');
  });

  it('Ajustes › Voz: 3 personas distintas (red y local cuentan como una), España después', () => {
    const opciones = opcionesVoz(ANDROID, EN_LINEA);
    expect(opciones.map((o) => o.id)).toEqual(['es-us-x-sfb', 'es-us-x-esd', 'es-us-x-esf']);
    expect(opciones.map((o) => o.etiqueta)).toEqual(['Voz 1', 'Voz 2', 'Voz 3']);
    expect(opciones[0]?.descripcion).toBe('Español de Estados Unidos · más natural con internet');
    expect(opciones[2]?.descripcion).toBe('Español de Estados Unidos · básica');
    expect(opcionesVoz(ANDROID, SIN_RED)[0]).toMatchObject({ id: 'es-us-x-sfb', calidad: 'mejorada' });
  });

  it('sin voces en español: ninguna (se habla con la del sistema)', () => {
    expect(elegirVoz([voz('en-us-x-iob-local', 'x', 'en-US')], SIN_RED)).toBeNull();
    expect(opcionesVoz([], SIN_RED)).toEqual([]);
  });
});

describe('velocidad y tono', () => {
  it.each([
    ['mejorada', 'normal', 0.95],
    ['premium', 'pausada', 0.85],
    ['red', 'rapida', 1.1],
    ['basica', 'normal', 0.9],
    [null, 'normal', 0.9],
  ] as const)('%s a velocidad %s → rate %s, tono natural', (calidad, velocidad, rate) => {
    expect(parametrosVoz(calidad, velocidad)).toEqual({ rate, pitch: 1 });
  });

  it('idiomas', () => {
    expect(normalizarIdioma('es_mx')).toBe('es-MX');
    expect(textoIdioma('es-US')).toBe('Español de Estados Unidos');
    expect(textoIdioma('es')).toBe('Español');
  });
});
