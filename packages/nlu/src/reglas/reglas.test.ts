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

  it('cobertura 16/16 y precisión 100 % sobre los 144 casos', () => {
    const reporte = evaluarReglas(golden, contexto);
    expect(reporte.marcados).toBe(16);
    expect(reporte.marcadosCubiertos).toBe(16);
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
});

describe('nivel 0 · responde null ante la duda', () => {
  const NULOS = [
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
