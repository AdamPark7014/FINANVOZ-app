import { describe, expect, it } from 'vitest';
import { compilarPlantillas, interpretarNotificacion, parsearMonto } from './plantillas';
import { ErrorDominio } from '../errores';
import {
  cargarEjemplos,
  cargarPlantillasEjemplo,
  type EjemploNotificacion,
} from '../__pruebas__/notificaciones';

const catalogo = compilarPlantillas(cargarPlantillasEjemplo());

function comprobar(ej: EjemploNotificacion): void {
  const { banco, ...resto } = interpretarNotificacion(
    { paquete: ej.paquete, titulo: ej.titulo, texto: ej.texto },
    catalogo,
  );
  expect(resto).toStrictEqual(ej.esperado);
  // El banco sale del paquete; con plantilla, es el banco de esa plantilla.
  const plantilla = catalogo.plantillas.find((p) => p.id === ej.esperado.plantilla);
  if (plantilla) expect(banco).toBe(plantilla.banco);
  else expect(typeof banco).toBe('string');
}

describe('07 §3 · ejemplos personales (CA-M1-07)', () => {
  const ejemplos = cargarEjemplos('ejemplos.jsonl');
  it('son 12', () => expect(ejemplos).toHaveLength(12));
  for (const ej of ejemplos) {
    it(`${ej.id} · ${ej.esperado.plantilla ?? 'sin plantilla'} → ${ej.esperado.tipo}`, () => comprobar(ej));
  }
});

describe('07 §3 · ejemplos de negocio', () => {
  const ejemplos = cargarEjemplos('negocio.ejemplos.jsonl');
  it('son 2', () => expect(ejemplos).toHaveLength(2));
  for (const ej of ejemplos) {
    it(`${ej.id} · ${ej.esperado.plantilla ?? 'sin plantilla'} → ${ej.esperado.tipo}`, () => comprobar(ej));
  }
});

describe('07 §3 · interpretarNotificacion', () => {
  it('paquete desconocido → no_reconocida sin banco', () =>
    expect(interpretarNotificacion({ paquete: 'mx.otro', titulo: 'x', texto: 'y' }, catalogo)).toEqual({
      banco: null,
      plantilla: null,
      tipo: 'no_reconocida',
    }));

  it('título o texto ausentes cuentan como vacíos', () =>
    expect(
      interpretarNotificacion({ paquete: 'mx.ejemplo.bancoa', titulo: null, texto: null }, catalogo).tipo,
    ).toBe('no_reconocida'));

  it('una plantilla que coincide pero con monto inválido → no_reconocida (se registra a mano)', () => {
    const c = compilarPlantillas({
      bancos: [{ id: 'b', paquetes_android: ['p'] }],
      plantillas: [{ id: 'b.x.v1', banco: 'b', tipo: 'cargo', campo: 'texto', patron: '^(?<monto>.+)$' }],
    });
    expect(interpretarNotificacion({ paquete: 'p', titulo: '', texto: '1.2.3' }, c)).toEqual({
      banco: 'b',
      plantilla: null,
      tipo: 'no_reconocida',
    });
  });

  it('la versión nueva agregada antes gana', () => {
    const c = compilarPlantillas({
      bancos: [{ id: 'b', paquetes_android: ['p'] }],
      plantillas: [
        { id: 'b.x.v2', banco: 'b', tipo: 'cargo', campo: 'texto', patron: '\\$(?<monto>\\d+)' },
        { id: 'b.x.v1', banco: 'b', tipo: 'cargo', campo: 'texto', patron: '\\$(?<monto>\\d+)' },
      ],
    });
    expect(interpretarNotificacion({ paquete: 'p', titulo: '', texto: '$5' }, c).plantilla).toBe('b.x.v2');
  });

  it('las plantillas de otro banco no se prueban', () => {
    const r = interpretarNotificacion(
      { paquete: 'mx.ejemplo.bancob', titulo: '', texto: 'Pagaste $96 a DiDi' },
      catalogo,
    );
    expect(r).toEqual({ banco: 'banco_b', plantilla: null, tipo: 'no_reconocida' });
  });
});

describe('07 §3 · compilarPlantillas', () => {
  const banco = { id: 'b', paquetes_android: ['p'] };
  const plantilla = { id: 'b.x.v1', banco: 'b', tipo: 'cargo', campo: 'texto', patron: 'x' };
  const invalida = (archivo: unknown) => {
    try {
      compilarPlantillas(archivo);
    } catch (e) {
      return e instanceof ErrorDominio ? e.codigo : 'otro';
    }
    return 'sin error';
  };

  it('acepta el archivo de ejemplo con sus 4 bancos', () => expect(catalogo.bancos).toHaveLength(4));
  it('rechaza un archivo que no es objeto', () => expect(invalida(null)).toBe('plantillas_invalidas'));
  it('rechaza un patrón que no compila', () =>
    expect(invalida({ bancos: [banco], plantillas: [{ ...plantilla, patron: '(' }] })).toBe(
      'plantillas_invalidas',
    ));
  it('rechaza un tipo desconocido', () =>
    expect(invalida({ bancos: [banco], plantillas: [{ ...plantilla, tipo: 'otro' }] })).toBe(
      'plantillas_invalidas',
    ));
  it('rechaza un campo desconocido', () =>
    expect(invalida({ bancos: [banco], plantillas: [{ ...plantilla, campo: 'cuerpo' }] })).toBe(
      'plantillas_invalidas',
    ));
  it('rechaza un banco inexistente', () =>
    expect(invalida({ bancos: [banco], plantillas: [{ ...plantilla, banco: 'z' }] })).toBe(
      'plantillas_invalidas',
    ));
  it('rechaza flags con estado (g, y)', () =>
    expect(invalida({ bancos: [banco], plantillas: [{ ...plantilla, flags: 'gi' }] })).toBe(
      'plantillas_invalidas',
    ));
  it('rechaza ids de plantilla repetidos', () =>
    expect(invalida({ bancos: [banco], plantillas: [plantilla, plantilla] })).toBe('plantillas_invalidas'));
  it('rechaza un paquete en dos bancos', () =>
    expect(invalida({ bancos: [banco, { ...banco, id: 'c' }], plantillas: [] })).toBe(
      'plantillas_invalidas',
    ));
});

describe('07 §3 · parsearMonto', () => {
  const casos: [string, number][] = [
    ['250.00', 25000],
    ['$1,830.00', 183000],
    ['96', 9600],
    ['1,099.9', 109990],
    ['$ 4,200.00 MXN', 420000],
    ['0.05', 5],
    ['12,345,678.90', 1234567890],
  ];
  for (const [s, c] of casos) it(`${s} → ${c}`, () => expect(parsearMonto(s)).toBe(c));

  for (const s of ['', '$', '1.2.3', '1.234', 'abc', '12.', '.50', '-5', '1e3', '٣']) {
    it(`rechaza ${JSON.stringify(s)}`, () => {
      expect(() => parsearMonto(s)).toThrow(ErrorDominio);
      try {
        parsearMonto(s);
      } catch (e) {
        expect((e as ErrorDominio).codigo).toBe('monto_invalido');
        // Regla 9: el mensaje no repite el texto de la notificación.
        if (s.length > 1) expect((e as ErrorDominio).message).not.toContain(s);
      }
    });
  }
});
