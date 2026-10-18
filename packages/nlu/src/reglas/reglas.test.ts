import { describe, expect, it } from 'vitest';
import { Interpretacion } from '../esquema';
import { compararInterpretacion } from '../eval/comparar';
import { evaluarReglas } from '../eval/evaluar';
import { cargarContexto, cargarGolden } from '../eval/fixtures';
import { interpretarReglas } from './index';

const { contexto } = cargarContexto();
const golden = cargarGolden();
const HOY = contexto.fecha_referencia;
const reglas = (texto: string) => interpretarReglas(texto, contexto);
const gasto = (texto: string) => {
  const r = reglas(texto);
  return r?.intencion === 'registrar' ? r.movimientos[0] : r;
};

describe('CA-M1-05 · golden set con reglas: true', () => {
  for (const caso of golden.filter((c) => c.reglas === true)) {
    it(caso.id, () => {
      const salida = reglas(caso.texto);
      expect(salida).not.toBeNull();
      expect(Interpretacion.safeParse(salida).success).toBe(true);
      expect(compararInterpretacion(caso.esperado, salida as Record<string, unknown>)).toEqual([]);
    });
  }

  it('cobertura 25/25 y precisión 100 % sobre los 155 casos', () => {
    const reporte = evaluarReglas(golden, contexto);
    expect(reporte.marcados).toBe(25);
    expect(reporte.marcadosCubiertos).toBe(25);
    expect(reporte.respondidosCorrectos).toBe(reporte.respondidos);
    expect(reporte.aprobado).toBe(true);
  });
});

describe('nivel 0 · formas aceptadas', () => {
  it('consulta con y sin "hoy", sin signos ni acentos', () => {
    expect(reglas('Cuanto puedo gastar')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'hoy_puedes' },
    });
    expect(reglas('¡¿CUÁNTO puedo gastar hoy?!')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'hoy_puedes' },
    });
  });

  it('arqueo en efectivo admite cero', () => {
    expect(reglas('traigo 0 en efectivo')).toEqual({ intencion: 'arqueo', efectivo_real: 0 });
  });

  it('arqueo en la cartera admite cero (misma gramática que efectivo)', () => {
    expect(reglas('traigo 0 en la cartera')).toEqual({ intencion: 'arqueo', efectivo_real: 0 });
  });

  it('montos mexicanos a centavos', () => {
    expect(gasto('uber 1,250.5')).toMatchObject({ monto: 125050 });
    expect(gasto('uber 1250')).toMatchObject({ monto: 125000 });
    expect(gasto('uber 0.99')).toMatchObject({ monto: 99 });
    expect(gasto('uber 1,000,000')).toMatchObject({ monto: 100000000 });
  });

  it('me cayó la quincena, con y sin coma', () => {
    const esperado = {
      intencion: 'registrar',
      movimientos: [{ tipo: 'ingreso', monto: 800000, fecha: HOY }],
    };
    expect(reglas('me cayó la quincena, 8,000')).toEqual(esperado);
    expect(reglas('me cayo la quincena 8000')).toEqual(esperado);
  });

  it('forma VERBO DESC MONTO con método y alias de varias palabras', () => {
    expect(gasto('me compré unos tenis de 1,800 con mercado pago')).toEqual({
      tipo: 'gasto',
      monto: 180000,
      fecha: HOY,
      descripcion: 'tenis',
      categoria: 'ropa',
      origen: { tipo: 'debito', alias: 'mercado pago' },
    });
  });

  it('descripción sin categoría con verbo; la forma sin verbo exige palabras del diccionario', () => {
    expect(gasto('pagué la plomería 300')).toMatchObject({ descripcion: 'plomería', monto: 30000 });
    expect(gasto('pagué la plomería 300')).not.toHaveProperty('categoria');
    expect(reglas('plomería 300')).toBeNull();
    expect(reglas('coca light 25')).toBeNull();
  });

  it('entradas de varias palabras ganan sobre las sueltas', () => {
    expect(gasto('youtube premium 159')).toMatchObject({ categoria: 'suscripciones' });
    expect(gasto('premium 500')).toMatchObject({ categoria: 'gasolina' });
  });

  it('palabras de dos categorías distintas: sin categoría', () => {
    expect(gasto('gasté tacos coca 100')).not.toHaveProperty('categoria');
  });

  it('la ñ no se confunde con el artículo "unas"', () => {
    expect(gasto('uñas 250')).toMatchObject({ categoria: 'cuidado_personal' });
    expect(gasto('uñas 250')).toMatchObject({ categoria: 'cuidado_personal' });
    expect(gasto('unas papas 30')).toMatchObject({ categoria: 'antojos', descripcion: 'papas' });
  });

  it('pago de tarjeta solo con alias de crédito', () => {
    expect(gasto('pagué 600 de la oro')).toMatchObject({
      tipo: 'pago_tarjeta',
      destino: { tipo: 'credito', alias: 'oro' },
    });
  });

  it('pendiente 98 · salud sin internet: "médica", "médico" y descripción compuesta del diccionario', () => {
    expect(gasto('consulta médica de 800 en efectivo')).toEqual({
      tipo: 'gasto',
      monto: 80000,
      fecha: HOY,
      descripcion: 'consulta médica',
      categoria: 'salud',
      origen: { tipo: 'efectivo' },
    });
    expect(gasto('800 de la consulta con el médico')).toMatchObject({
      monto: 80000,
      categoria: 'salud',
      descripcion: 'consulta con el médico',
    });
    expect(gasto('medicinas de la farmacia 385')).toMatchObject({ monto: 38500, categoria: 'salud' });
    expect(gasto('pagué 1,200 en el hospital')).toMatchObject({ monto: 120000, categoria: 'salud' });
    expect(gasto('análisis 650 con débito')).toMatchObject({
      categoria: 'salud',
      origen: { tipo: 'debito' },
    });
  });
});

describe('nivel 0 · gasto compartido con la pareja (02 §27)', () => {
  const compartido = (texto: string) => {
    const r = reglas(texto);
    return r?.intencion === 'gasto_compartido' ? r.gasto : r;
  };

  it('"Súper 1,200, pagué yo, 60/40": si pagaste tú, la primera cifra es tu parte', () => {
    expect(reglas('Súper 1,200, pagué yo, 60/40')).toEqual({
      intencion: 'gasto_compartido',
      gasto: {
        monto: 120000,
        fecha: HOY,
        descripcion: 'súper',
        categoria: 'super',
        pagador: 'yo',
        mi_parte: 60,
      },
    });
    expect(compartido('súper 1200 40/60 lo pagué yo')).toMatchObject({ mi_parte: 40, pagador: 'yo' });
  });

  it('pagó ella, él, mi pareja o un nombre', () => {
    expect(compartido('gasto compartido de 500 en gasolina, pagó ella')).toMatchObject({
      monto: 50000,
      categoria: 'gasolina',
      pagador: 'pareja',
      mi_parte: 50,
    });
    expect(compartido('pagó él la luz 900 a medias')).toMatchObject({
      pagador: 'pareja',
      categoria: 'servicios',
    });
    expect(compartido('luz 900 a medias, pagó él')).toMatchObject({
      pagador: 'pareja',
      categoria: 'servicios',
    });
    expect(compartido('pagó mi esposa 300 del cine, 50/50')).toMatchObject({ pagador: 'pareja' });
    expect(compartido('pagó Ana 300 del cine, 50/50')).toEqual({
      monto: 30000,
      fecha: HOY,
      descripcion: 'cine',
      categoria: 'entretenimiento',
      pagador: 'pareja',
      mi_parte: 50,
      grupo: 'ana',
    });
  });

  it('sin decir quién pagó, mitad y mitad; "8 mil" son 8,000 pesos', () => {
    expect(compartido('la renta 8 mil mitad y mitad con mi pareja')).toEqual({
      monto: 800000,
      fecha: HOY,
      descripcion: 'renta',
      categoria: 'vivienda',
      mi_parte: 50,
    });
    expect(compartido('pagué 900 de luz compartido con mi pareja')).toMatchObject({
      monto: 90000,
      pagador: 'yo',
      mi_parte: 50,
    });
  });

  it('con señal de compartido pero sin certeza responde null (nunca un gasto propio)', () => {
    for (const texto of [
      'súper 1,200, pagó ella, 60/40',
      'súper 1,200 60/40',
      'súper 1,200, pagué yo, 60/30',
      'súper 1,200, pagué yo, 100/0',
      'súper 1,200, pagué yo, 60/40, 50/50',
      'pagué yo y pagó ella el súper 1,200 a medias',
      'ayer súper 1,200 a medias',
      'súper 1,200 compartido con débito',
      'plomería 1,200 compartido',
      'súper compartido',
      'súper 1,200 y tacos 300 a medias',
      'pagó 1,200 del súper a medias',
      'pagó la renta 8 mil a medias',
    ]) {
      expect(reglas(texto), texto).toBeNull();
    }
  });

  it('sin señal de compartido sigue siendo un gasto propio', () => {
    expect(reglas('súper 1200 con débito')).toMatchObject({ intencion: 'registrar' });
    expect(reglas('pagué 1,200 en el súper')).toMatchObject({ intencion: 'registrar' });
  });
});

describe('nivel 0 · responde null ante la duda', () => {
  const NULOS = [
    'me depositaron 0',
    'me quedan 85 pesos en efectivo',
    'tengo 4,200 en BBVA',
    'registra 50',
    'me compré una coca',
    'unos tacos de 80 y una coca de 25',
    'ayer tacos 80',
    'tacos 80 ayer',
    'gasté 300 en efectivo',
    'pagué 3,000 de la bbva',
    'pagué el mínimo 600',
    'pagué la tanda 500',
    'pagué la tarjeta 600',
    'gasté 500 en la tienda',
    'compré mercancía 2,300',
    'pagué juan 200',
    'tacos 80 con la azul',
    'tacos $80',
    'tacos 1.5k',
    'tacos ochenta',
    'tacos 80.505',
    'tacos 0',
    'saqué 0 del cajero',
    'tacos, 80',
    'me compré unos tacos al pastor de 80',
    'me compré unos tacos muy muy ricos de 80',
    'cuanto puedo gastar mañana',
    'traigo 340 en la bolsa',
    'saqué 500 del cajero de la oro',
    'pagué 3,000 de la nu con bbva',
    'tacos 1234567890',
    '',
  ];
  for (const texto of NULOS) {
    it(JSON.stringify(texto), () => {
      expect(reglas(texto)).toBeNull();
    });
  }
});
