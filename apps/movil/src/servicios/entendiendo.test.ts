import { describe, expect, it } from 'vitest';
import { NADA_ENTENDIDO, prepararEntendiendo } from './entendiendo';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** «Voy entendiendo» (D2): el nivel 0 sobre la frase a medias, en el teléfono y sin registrar nada. */
describe('voy entendiendo', () => {
  const leer = () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    return prepararEntendiendo(p.ctx);
  };

  it('frase completa: la cifra, la categoría y la cuenta ya seguras', () => {
    expect(leer()('coca 25 en efectivo')).toEqual({
      monto: 2_500,
      categoria: { slug: 'antojos', nombre: 'Antojos' },
      cuenta: { nombre: 'Cartera', seguro: true },
      meAlcanza: false,
    });
  });

  it('a medias: lo que ya se entiende y la cuenta que empieza como la última palabra («efec…»)', () => {
    const entendido = leer()('coca de 25 en efec');
    expect(entendido.monto).toBe(2_500);
    expect(entendido.categoria?.slug).toBe('antojos');
    expect(entendido.cuenta).toEqual({ nombre: 'Cartera', seguro: false });
  });

  it('¿me alcanza? y lo que todavía no dice nada', () => {
    const l = leer();
    expect(l('me alcanza para unos tenis de 500')).toMatchObject({ monto: 50_000, meAlcanza: true });
    expect(l('')).toEqual(NADA_ENTENDIDO);
    expect(l('este')).toEqual(NADA_ENTENDIDO);
  });
});
