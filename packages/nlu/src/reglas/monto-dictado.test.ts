import { describe, expect, it } from 'vitest';
import { interpretarMonto } from '../index';

const conCero = (texto: string) => interpretarMonto(texto, { admiteCero: true });
const sinCero = (texto: string) => interpretarMonto(texto, { admiteCero: false });

describe('interpretarMonto · monto dictado en un campo (06 §9.4)', () => {
  it('cifra sola, con preludio, con centavos y con "N mil M"', () => {
    expect(sinCero('500')).toEqual({ centavos: 50_000, aproximado: false });
    expect(sinCero('8 mil 500')).toEqual({ centavos: 850_000, aproximado: false });
    expect(sinCero('treinta y un mil novecientos diez')).toEqual({ centavos: 3_191_000, aproximado: false });
    expect(sinCero('son 85 pesos con 50 centavos')).toEqual({ centavos: 8_550, aproximado: false });
    expect(sinCero('me salen 2,300.50')).toEqual({ centavos: 230_050, aproximado: false });
    expect(sinCero('el arqueo da 640')).toEqual({ centavos: 64_000, aproximado: false });
    expect(sinCero('quiero guardar 2 mil')).toEqual({ centavos: 200_000, aproximado: false });
    expect(sinCero('le debo 12 mil')).toEqual({ centavos: 1_200_000, aproximado: false });
    expect(sinCero('me cobran $219')).toEqual({ centavos: 21_900, aproximado: false });
    expect(sinCero('Guárdame un kilo')).toEqual({ centavos: 100_000, aproximado: false });
    for (const preludio of [
      'son',
      'es',
      'fueron',
      'fue',
      'serían',
      'da',
      'me da',
      'conté',
      'me salen',
      'pon',
      'ponle',
      'anota',
      'quiero',
      'quiero tener',
      'guarda',
      'aparta',
      'traigo',
      'tengo',
      'debo',
      'me pagan',
      'gano',
      'me prestan',
      'me queda',
      'me quedan',
      'cuesta',
      'me cuesta',
    ]) {
      expect(sinCero(`${preludio} 300`), preludio).toEqual({ centavos: 30_000, aproximado: false });
    }
  });

  it('"como", "más o menos", "aproximadamente" → aproximado', () => {
    expect(sinCero('como 500')).toEqual({ centavos: 50_000, aproximado: true });
    expect(sinCero('son más o menos 1,200')).toEqual({ centavos: 120_000, aproximado: true });
    expect(sinCero('aproximadamente 300 pesos')).toEqual({ centavos: 30_000, aproximado: true });
    expect(sinCero('traigo como 85 pesos con 50 centavos')).toEqual({ centavos: 8_550, aproximado: true });
  });

  it('cero solo si el campo lo admite', () => {
    for (const texto of [
      'cero',
      'cero pesos',
      'nada',
      'ni un peso',
      'ni un varo',
      'no traigo nada',
      'no tengo nada',
      'no debo nada',
      'traigo nada',
      '0',
      'son 0 pesos',
    ]) {
      expect(conCero(texto), texto).toEqual({ centavos: 0, aproximado: false });
      expect(sinCero(texto), texto).toBeNull();
    }
  });

  it('null ante la duda: rangos, cotas, dos cifras, frecuencias, "no" suelto, jerga de peso', () => {
    for (const texto of [
      '',
      'más de 500',
      'menos de 500',
      'entre 500 y 600',
      'hasta 500',
      '500 o 600',
      '500 600',
      'son 500 al mes',
      '500 cada quincena',
      'no 500',
      'no tengo 500',
      'tengo no traigo nada',
      'ocho mil y medio',
      'un millón',
      'dos cincuenta',
      'un kilo de carne',
      'quinientos de la luz',
      'un peso',
    ]) {
      expect(conCero(texto), texto).toBeNull();
    }
  });
});
