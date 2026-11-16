import { describe, expect, it } from 'vitest';
import { centavosDePesos, formatearCentavos, pesosDeCentavos } from './dinero';
import { encabezadoMes, hoyMexico, sumarDias } from './fecha';

describe('dinero de la UI', () => {
  it('lee pesos escritos sin pasar por flotantes', () => {
    expect(centavosDePesos('99')).toBe(9900);
    expect(centavosDePesos('99.5')).toBe(9950);
    expect(centavosDePesos('0.07')).toBe(7);
    expect(centavosDePesos('1234567.89')).toBe(123456789);
    expect(centavosDePesos('')).toBeNull();
    expect(centavosDePesos('abc')).toBeNull();
    expect(centavosDePesos('1.234')).toBeNull();
  });

  it('ida y vuelta pesos ↔ centavos', () => {
    for (const c of [0, 7, 9900, 9950, 123456789]) expect(centavosDePesos(pesosDeCentavos(c))).toBe(c);
  });

  it('formatea sin centavos cuando son .00', () => {
    expect(formatearCentavos(1_500_000)).toBe('$15,000');
    expect(formatearCentavos(16335)).toBe('$163.35');
  });
});

describe('fechas en la Ciudad de México', () => {
  it('a las 20 h de Puebla sigue siendo el mismo día aunque en UTC ya sea mañana', () => {
    expect(hoyMexico(new Date('2026-11-16T02:00:00Z'))).toBe('2026-11-15');
  });

  it('suma días cruzando mes y arma el encabezado', () => {
    expect(sumarDias('2026-11-28', 5)).toBe('2026-12-03');
    expect(encabezadoMes('2026-11-15')).toBe('Noviembre 2026 · al domingo 15');
  });
});
