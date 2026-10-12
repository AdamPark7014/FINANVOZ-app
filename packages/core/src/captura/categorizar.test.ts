import { describe, expect, it } from 'vitest';
import { CATALOGO_SEMILLA, categorizarComercio, construirCatalogo } from './categorizar';
import { compilarPlantillas, interpretarNotificacion } from './plantillas';
import { normalizarComercio } from '../comercios';
import { ErrorDominio } from '../errores';
import { cargarEjemplos, cargarPlantillasEjemplo } from '../__pruebas__/notificaciones';

/** Categorías del espacio personal (`docs/04-DATOS.md §2.3`). */
const CATEGORIAS_PERSONALES = new Set([
  'comida_fuera',
  'antojos',
  'super',
  'transporte',
  'gasolina',
  'entretenimiento',
  'ropa',
  'hogar',
  'cuidado_personal',
  'salud',
  'mascotas',
  'regalos',
  'apoyo_familiar',
  'viajes',
  'tecnologia',
  'deporte',
  'otros_gastos',
  'vivienda',
  'servicios',
  'suscripciones',
  'educacion',
  'comisiones_intereses',
]);

const categoria = (s: string) => categorizarComercio(s)?.categoria ?? null;

describe('07 §6 · catálogo semilla', () => {
  it('todas sus categorías existen en 04 §2.3', () => {
    for (const e of CATALOGO_SEMILLA) expect(CATEGORIAS_PERSONALES).toContain(e.categoria);
  });
  it('sus prefijos están normalizados y no se repiten', () => {
    const vistos = new Set<string>();
    for (const e of CATALOGO_SEMILLA) {
      expect(normalizarComercio(e.prefijo)).toBe(e.prefijo);
      expect(vistos.has(e.prefijo)).toBe(false);
      vistos.add(e.prefijo);
    }
  });
});

describe('07 §6 · prefijo de tokens más largo (pruebas obligatorias)', () => {
  it('OXXO GAS → gasolina aunque OXXO → antojos', () => {
    expect(categoria('OXXO GAS')).toBe('gasolina');
    expect(categoria('OXXO GAS ES 4410')).toBe('gasolina');
    expect(categoria('OXXO')).toBe('antojos');
  });
  it('UBER EATS → comida_fuera aunque UBER → transporte', () => {
    expect(categoria('UBER EATS')).toBe('comida_fuera');
    expect(categoria('UBER *EATS PENDING')).toBe('comida_fuera');
    expect(categoria('UBER')).toBe('transporte');
    expect(categoria('UBER *TRIP HELP.UBER.COM')).toBe('transporte');
  });
});

describe('07 §6 · categorizarComercio', () => {
  it('coincide por tokens completos, no por subcadena', () => {
    expect(categoria('OXXOGAS')).toBeNull();
    expect(categoria('BPX')).toBeNull();
    expect(categoria('MAXIMA')).toBeNull();
  });
  it('normaliza con E9.1 (acentos, sufijos, sucursal)', () => {
    expect(categoria('Cinépolis Plaza Dorada')).toBe('entretenimiento');
    expect(categoria('wal-mart sucursal 2231')).toBe('super');
    expect(categoria('7-Eleven #1234')).toBe('antojos');
  });
  it('sin comercio o sin coincidencia → null (la tarjeta pregunta y aprende)', () => {
    expect(categorizarComercio(null)).toBeNull();
    expect(categorizarComercio('')).toBeNull();
    expect(categoria('TIENDA EN LINEA MX')).toBeNull();
  });
  it('la regla del usuario gana sobre el catálogo', () => {
    const reglas = new Map([['OXXO PUEBLA', 'super']]);
    expect(categorizarComercio('OXXO PUEBLA 123', reglas)).toEqual({
      categoria: 'super',
      fuente: 'usuario',
    });
    expect(categorizarComercio('OXXO CENTRO', reglas)).toEqual({
      categoria: 'antojos',
      fuente: 'semilla',
      prefijo: 'OXXO',
    });
  });
  it('categoriza los cargos de los ejemplos de notificaciones', () => {
    const catalogo = compilarPlantillas(cargarPlantillasEjemplo());
    const porId = new Map(
      cargarEjemplos('ejemplos.jsonl').map((ej) => [ej.id, interpretarNotificacion(ej, catalogo)]),
    );
    expect(categorizarComercio(porId.get('N-01')?.comercio)?.categoria).toBe('antojos');
    expect(categorizarComercio(porId.get('N-06')?.comercio)?.categoria).toBe('super');
    expect(categorizarComercio(porId.get('N-09')?.comercio)?.categoria).toBe('transporte');
    expect(categorizarComercio(porId.get('N-12')?.comercio)).toBeNull();
  });
});

describe('07 §6 · construirCatalogo', () => {
  it('rechaza un prefijo que normalizado choca con otra categoría', () => {
    try {
      construirCatalogo({ categorias: { a: ['OXXO'], b: ['oxxo'] } });
      expect.unreachable();
    } catch (e) {
      expect((e as ErrorDominio).codigo).toBe('catalogo_invalido');
    }
  });
  it('rechaza un prefijo que normalizado queda vacío', () =>
    expect(() => construirCatalogo({ categorias: { a: ['S.A. DE C.V.'] } })).toThrow(ErrorDominio));
});
