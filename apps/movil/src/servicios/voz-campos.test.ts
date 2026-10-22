import { describe, expect, it } from 'vitest';
import { leerMontoDictado } from './voz-campos';

describe('leerMontoDictado · la cifra dicha en un campo de dinero', () => {
  it('lee cifras en palabras y en número, con preludio, a centavos enteros', () => {
    const sinCero = { admiteCero: false };
    expect(leerMontoDictado('ocho mil quinientos', sinCero)).toEqual({
      centavos: 850_000,
      aproximado: false,
    });
    expect(leerMontoDictado('son 85 pesos con 50 centavos', sinCero)).toEqual({
      centavos: 8_550,
      aproximado: false,
    });
    expect(leerMontoDictado('me salen 2,300.50', sinCero)).toEqual({ centavos: 230_050, aproximado: false });
  });

  it('marca lo aproximado', () => {
    expect(leerMontoDictado('como quinientos', { admiteCero: false })).toEqual({
      centavos: 50_000,
      aproximado: true,
    });
  });

  it('sin cifra clara no inventa una', () => {
    expect(leerMontoDictado('hola qué tal', { admiteCero: false })).toBeNull();
    expect(leerMontoDictado('', { admiteCero: false })).toBeNull();
  });

  it('cero solo si el campo lo admite', () => {
    expect(leerMontoDictado('no debo nada', { admiteCero: true })).toEqual({
      centavos: 0,
      aproximado: false,
    });
    expect(leerMontoDictado('cero', { admiteCero: false })).toBeNull();
  });
});
