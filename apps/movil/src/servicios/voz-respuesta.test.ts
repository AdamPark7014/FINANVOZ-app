import { describe, expect, it } from 'vitest';
import type { TurnoAsistente } from '../asistente/tipos';
import type { PropuestaEntendi } from '../ui/entendi';
import { fijarBloqueo } from './ajustes';
import { AJUSTES_VOZ_INICIALES, fijarAjustesVoz, obtenerAjustesVoz } from './preferencias';
import { cargarEscenario } from './semilla';
import {
  cuentaDicha,
  diaDicho,
  FRASE_NO_ENTENDI,
  FRASE_NO_ENTENDI_SIN_OPCIONES,
  FRASE_SIN_DIA,
  fijarVozRespuesta,
  fraseHablada,
  limpiarParaVoz,
  montoDicho,
  obtenerVozRespuesta,
  segundosHablados,
  silabasAproximadas,
  type DatosHablados,
} from './voz-respuesta';
import { abrirPrueba, escenario } from './__pruebas__/base';

describe('Contestarte en voz (ajuste)', () => {
  it('encendido por omisión; apagado por omisión con bloqueo biométrico; la elección gana', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: true });
    fijarBloqueo(p.ctx, { activo: true });
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: false });
    fijarVozRespuesta(p.ctx, true);
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: true });
    fijarVozRespuesta(p.ctx, false);
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: false });
  });
});

describe('Ajustes › Voz: cómo suena (preferencias)', () => {
  it('sin nada guardado: la mejor voz, velocidad normal, callado en silencio y la guía sin mostrar', () => {
    const p = abrirPrueba();
    expect(obtenerAjustesVoz(p.ctx)).toEqual(AJUSTES_VOZ_INICIALES);
    expect(AJUSTES_VOZ_INICIALES).toEqual({
      voz: null,
      velocidad: 'normal',
      enSilencio: false,
      guiaMejoradaVista: false,
    });
  });

  it('cambia solo lo que se pasa y la voz elegida se recuerda', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    fijarAjustesVoz(p.ctx, { voz: 'com.apple.voice.enhanced.es-MX.Paulina' });
    fijarAjustesVoz(p.ctx, { velocidad: 'pausada' });
    fijarAjustesVoz(p.ctx, { enSilencio: true });
    expect(obtenerAjustesVoz(p.ctx)).toEqual({
      voz: 'com.apple.voice.enhanced.es-MX.Paulina',
      velocidad: 'pausada',
      enSilencio: true,
      guiaMejoradaVista: false,
    });
    fijarAjustesVoz(p.ctx, { voz: null });
    expect(obtenerAjustesVoz(p.ctx).voz).toBeNull();
    expect(obtenerAjustesVoz(p.ctx).velocidad).toBe('pausada');
  });

  it('pide el consentimiento y rechaza valores fuera de la lista', () => {
    const p = abrirPrueba();
    expect(() => fijarAjustesVoz(p.ctx, { velocidad: 'rapida' })).toThrow();
    expect(obtenerAjustesVoz(p.ctx)).toEqual(AJUSTES_VOZ_INICIALES);
    cargarEscenario(p.ctx, escenario('e4-01'));
    expect(() => fijarAjustesVoz(p.ctx, { velocidad: 'turbo' as never })).toThrow();
    expect(() => fijarAjustesVoz(p.ctx, { voz: '' })).toThrow();
  });
});

describe('cifras y cuentas dichas', () => {
  it.each([
    [2_500, 'veinticinco'],
    [2_100, 'veintiuno'],
    [150_000, 'mil quinientos'],
    [2_550, 'veinticinco con cincuenta'],
    [100, 'un peso'],
    [50, 'cincuenta centavos'],
    [21, 'veintiún centavos'],
    [101, 'un peso con un centavo'],
    [0, 'cero'],
    [-37_400, 'menos trescientos setenta y cuatro'],
    [100_000_000, 'un millón'],
  ])('montoDicho(%i) → «%s»', (centavos, dicho) => {
    expect(montoDicho(centavos)).toBe(dicho);
  });

  it('con modo pesos se queda con los pesos enteros, como «Hoy puedes»', () => {
    expect(montoDicho(18_950, 'pesos')).toBe('ciento ochenta y nueve');
  });

  it.each([
    ['Efectivo', false, 'en efectivo'],
    ['Nu ••4410', false, 'con tu Nu'],
    ['Nu terminación 4410', false, 'con tu Nu'],
    ['BBVA débito', false, 'con tu BBVA'],
    ['BBVA crédito', false, 'con tu BBVA de crédito'],
    ['Banorte (nómina)', true, 'en tu Banorte'],
    ['Mi Mercado Pago', false, 'con tu Mercado Pago'],
    ['por asignar', false, null],
  ] as const)('cuentaDicha(%s) → %s', (cuenta, ingreso, dicha) => {
    expect(cuentaDicha(cuenta, ingreso)).toBe(dicha);
  });

  it('limpiarParaVoz: sin símbolos, terminaciones, exclamaciones ni abreviaturas', () => {
    expect(limpiarParaVoz('«Tacos» $80 · Comida fuera · Nu ••4410')).toBe(
      'Tacos ochenta pesos, Comida fuera, Nu',
    );
    expect(limpiarParaVoz('¡Listo! Caro ×2')).toBe('Listo Caro 2 veces');
    expect(limpiarParaVoz('Llevas 3/12 de tus MSI, el 25 % del total.')).toBe(
      'Llevas 3 de 12 de tus meses sin intereses, el 25 por ciento del total.',
    );
    expect(limpiarParaVoz('Tu día: $220 → $214')).toBe(
      'Tu día: doscientos veinte pesos, doscientos catorce pesos',
    );
  });

  it.each([
    ['Tu día pasa de $214 a $189.', null, 'Te quedan ciento ochenta y nueve para hoy.'],
    ['Tu día pasa de $200 a $450.', null, 'Ahora puedes gastar cuatrocientos cincuenta hoy.'],
    ['Tu día pasa de $40 a $0.', null, FRASE_SIN_DIA],
    ['Tu día pasa de $40 a −$15.', null, FRASE_SIN_DIA],
    [undefined, 20_750, 'Te quedan doscientos siete para hoy.'],
    [undefined, 150, 'Te queda un peso para hoy.'],
    [undefined, null, null],
  ] as const)('diaDicho(%s, %s) → %s', (cambio, hoyPuedes, dicho) => {
    expect(diaDicho(cambio, hoyPuedes)).toBe(dicho);
  });
});

function entendi(p: Partial<PropuestaEntendi> & Pick<PropuestaEntendi, 'filas'>): TurnoAsistente {
  return {
    id: 'e',
    de: 'asistente',
    clase: 'entendi',
    propuesta: { titulo: 'Entendí · ¿lo registro?', confirmar: { etiqueta: 'Sí', accion: () => {} }, ...p },
  };
}

const chips = (...etiquetas: string[]) => etiquetas.map((etiqueta, i) => ({ valor: String(i), etiqueta }));

const pregunta = (texto: string, ...etiquetas: string[]): TurnoAsistente => ({
  id: 'q',
  de: 'asistente',
  clase: 'pregunta',
  texto,
  chips: chips(...etiquetas),
  responder: () => {},
});

const CASOS: readonly (readonly [string, TurnoAsistente, DatosHablados, string])[] = [
  // registro
  [
    'registro en efectivo con el cambio del día',
    {
      id: 'r',
      de: 'asistente',
      clase: 'registro',
      texto: 'Registré Coca $25 · Antojos · Efectivo.',
      cambioDia: 'Tu día pasa de $214 a $189.',
    },
    {},
    'Listo, coca de veinticinco en efectivo. Te quedan ciento ochenta y nueve para hoy.',
  ],
  [
    'registro con tarjeta: «tu Nu», sin terminación; el día sale de hoyPuedes',
    { id: 'r', de: 'asistente', clase: 'registro', texto: 'Registré Tacos $80 · Comida fuera · Nu ••4410.' },
    { hoyPuedes: 20_750 },
    'Listo, tacos de ochenta con tu Nu. Te quedan doscientos siete para hoy.',
  ],
  [
    'dos movimientos en una frase',
    {
      id: 'r',
      de: 'asistente',
      clase: 'registro',
      texto: 'Registré Coca $25 · Antojos · Efectivo; Hielo $30 · Súper · BBVA débito.',
    },
    {},
    'Listo, coca de veinticinco en efectivo y hielo de treinta con tu BBVA.',
  ],
  [
    'ingreso: entra «en tu BBVA» y el día sube',
    {
      id: 'r',
      de: 'asistente',
      clase: 'registro',
      texto: 'Registré Sueldo $8,000 · BBVA.',
      cambioDia: 'Tu día pasa de $200 a $450.',
    },
    {},
    'Listo, sueldo de ocho mil en tu BBVA. Ahora puedes gastar cuatrocientos cincuenta hoy.',
  ],
  [
    'el día queda en cero: lo describe sin aconsejar',
    { id: 'r', de: 'asistente', clase: 'registro', texto: 'Registré Renta $5,000 · Vivienda · Banorte.' },
    { hoyPuedes: 0 },
    `Listo, renta de cinco mil con tu Banorte. ${FRASE_SIN_DIA}`,
  ],
  [
    'centavos y cuenta por asignar',
    { id: 'r', de: 'asistente', clase: 'registro', texto: 'Registré Café $45.50 · por asignar.' },
    {},
    'Listo, café de cuarenta y cinco con cincuenta.',
  ],
  [
    'otro texto de registro («Deshice…»): tal cual',
    { id: 'r', de: 'asistente', clase: 'registro', texto: 'Deshice el registro.' },
    {},
    'Deshice el registro.',
  ],
  // entendí
  [
    'entendí: qué y cuánto, y la pregunta con la cuenta',
    entendi({
      monto: 45_000,
      filas: [
        { clave: 'que', etiqueta: 'Qué', valor: 'Luz' },
        { clave: 'cuenta', etiqueta: 'Cuenta', valor: 'BBVA débito' },
        { clave: 'categoria', etiqueta: 'Categoría', valor: 'Servicios' },
        { clave: 'cuando', etiqueta: 'Cuándo', valor: 'Hoy' },
      ],
    }),
    {},
    'Luz de cuatrocientos cincuenta. ¿Lo registro con tu BBVA?',
  ],
  [
    'entendí con efecto en el día (describe, no aconseja)',
    entendi({
      monto: 45_000,
      filas: [
        { clave: 'que', etiqueta: 'Qué', valor: 'Luz' },
        { clave: 'cuenta', etiqueta: 'Cuenta', valor: 'BBVA débito' },
      ],
      efecto: 'La luz ya estaba apartada: tu día sigue en $214.',
    }),
    {},
    'Luz de cuatrocientos cincuenta. La luz ya estaba apartada: tu día sigue en doscientos catorce pesos. ¿Lo registro con tu BBVA?',
  ],
  [
    'entendí de una compra a meses con tarjeta',
    entendi({
      monto: 1_200_000,
      filas: [
        { clave: 'que', etiqueta: 'Qué', valor: 'Tele' },
        { clave: 'meses', etiqueta: 'Meses', valor: '12 meses' },
        { clave: 'tarjeta', etiqueta: 'Tarjeta', valor: 'Nu ••4410' },
      ],
    }),
    {},
    'Tele de doce mil. ¿Lo registro con tu Nu?',
  ],
  [
    'entendí sin qué: el valor que importa (colchón)',
    entendi({
      titulo: 'Entendí · ¿lo guardo?',
      filas: [{ clave: 'colchon', etiqueta: 'Colchón', valor: 'Hoy apartas $500' }],
    }),
    {},
    'Hoy apartas quinientos pesos. ¿Lo guardo?',
  ],
  [
    'entendí sin pregunta en el título',
    entendi({ titulo: 'Entendí', monto: 2_500, filas: [{ clave: 'que', etiqueta: 'Qué', valor: 'Coca' }] }),
    {},
    'Coca de veinticinco. ¿Está bien así?',
  ],
  // pregunta
  [
    'pregunta con tres opciones: las dice, sin terminaciones',
    pregunta('¿Con qué tarjeta?', 'Nu ••4410', 'BBVA ••1234', 'Santander ••9999'),
    {},
    '¿Con qué tarjeta? Nu, BBVA o Santander.',
  ],
  [
    'pregunta: «u» ante «o»',
    pregunta('¿Cuál tarjeta?', 'Santander', 'Oxxo Card'),
    {},
    '¿Cuál tarjeta? Santander u Oxxo Card.',
  ],
  [
    'pregunta con más de tres opciones: solo la pregunta',
    pregunta('¿Cuál cuenta?', 'Nu', 'BBVA', 'Santander', 'Efectivo'),
    {},
    '¿Cuál cuenta?',
  ],
  [
    'pregunta con opciones que se oirían iguales: solo la pregunta',
    pregunta('¿Cuál Nu?', 'Nu ••4410', 'Nu ••9876'),
    {},
    '¿Cuál Nu?',
  ],
  [
    'pregunta de monto, con la cifra dicha',
    pregunta('¿Cuánto efectivo traes? Deberías traer $640'),
    {},
    '¿Cuánto efectivo traes? Deberías traer seiscientos cuarenta pesos.',
  ],
  [
    'un aviso con chips de acción no lee los chips',
    pregunta(
      'Lo guardé; lo interpreto cuando tengas internet.',
      'Es un gasto',
      'Es un ingreso',
      'Escribirlo',
    ),
    {},
    'Lo guardé; lo interpreto cuando tengas internet.',
  ],
  // aviso
  [
    'aviso: el texto dicho',
    {
      id: 'a',
      de: 'asistente',
      clase: 'aviso',
      texto: 'Tu BBVA corta mañana: llevas $3,200 este periodo.',
      detalle: 'Detalle largo que no se dice.',
      acciones: [],
      origen: 'tarjeta_accion',
    },
    {},
    'Tu BBVA corta mañana: llevas tres mil doscientos pesos este periodo.',
  ],
  [
    'aviso largo: dos oraciones como máximo',
    {
      id: 'a',
      de: 'asistente',
      clase: 'aviso',
      texto: 'Esta semana gastaste más en antojos. Llevas $900. La semana pasada llevabas $600.',
      acciones: [],
      origen: 'observacion',
    },
    {},
    'Esta semana gastaste más en antojos. Llevas novecientos pesos.',
  ],
  // no entendí
  [
    'no entendí con opciones: no repite lo que oyó',
    {
      id: 'n',
      de: 'asistente',
      clase: 'no_entendi',
      oido: 'taco ochenta fectivo',
      opciones: chips('Gasto de $80', 'Ingreso de $80', 'Otra cosa'),
      elegir: () => {},
      corregir: () => {},
    },
    {},
    FRASE_NO_ENTENDI,
  ],
  [
    'no entendí sin opciones',
    {
      id: 'n',
      de: 'asistente',
      clase: 'no_entendi',
      oido: 'mmm',
      opciones: [],
      elegir: () => {},
      corregir: () => {},
    },
    {},
    FRASE_NO_ENTENDI_SIN_OPCIONES,
  ],
  // texto
  [
    'texto de consulta, con la cifra en palabras',
    { id: 't', de: 'asistente', clase: 'texto', texto: 'Esta semana llevas $1,240 en antojos.' },
    {},
    'Esta semana llevas mil doscientos cuarenta pesos en antojos.',
  ],
  [
    'texto sin exclamaciones ni abreviaturas',
    { id: 't', de: 'asistente', clase: 'texto', texto: '¡Vas bien! Llevas 3/12 de tus MSI' },
    {},
    'Vas bien Llevas 3 de 12 de tus meses sin intereses.',
  ],
];

describe('fraseHablada (lo que dice el asistente, por tipo de turno)', () => {
  it.each(CASOS)('%s', (_caso, turno, datos, frase) => {
    expect(fraseHablada(turno, datos)).toBe(frase);
  });

  it('los turnos de la persona y las clases que no se dicen: nada', () => {
    expect(fraseHablada({ id: 'p', de: 'persona', texto: 'coca 25', porVoz: true } as never)).toBeNull();
    expect(fraseHablada({ de: 'asistente', clase: 'tarjeta' })).toBeNull();
    expect(fraseHablada({ de: 'asistente' })).toBeNull();
  });

  it('nunca lee símbolos, terminaciones de tarjeta ni exclamaciones; tutea', () => {
    for (const [, turno, datos] of CASOS) {
      const frase = fraseHablada(turno, datos) ?? '';
      expect(frase).not.toMatch(/[$•«»!¡·→×%]|\d{4}|usted/i);
      expect(frase).toMatch(/[.?]$/);
    }
  });

  it('frases cortas: cada una se dice en menos de 9 s a velocidad normal', () => {
    for (const [, turno, datos] of CASOS) {
      const frase = fraseHablada(turno, datos) ?? '';
      expect(segundosHablados(frase, 0.95)).toBeLessThan(9);
    }
    // La de Adam: «Listo, coca de veinticinco…» (28 sílabas): medida en 6.4 s con los silencios del archivo.
    const listo = 'Listo, coca de veinticinco en efectivo. Te quedan ciento ochenta y nueve para hoy.';
    expect(silabasAproximadas(listo)).toBe(28);
    expect(segundosHablados(listo, 0.95)).toBeGreaterThan(5);
    expect(segundosHablados(listo, 0.95)).toBeLessThan(6.5);
    expect(segundosHablados(listo, 1.1)).toBeLessThan(segundosHablados(listo, 0.85));
  });
});
