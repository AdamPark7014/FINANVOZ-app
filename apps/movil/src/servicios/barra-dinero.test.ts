import { describe, expect, it } from 'vitest';
import { barraDinero } from './barra-dinero';

/** La barra de tu dinero (B+, D1) sale del desglose de E4; nunca hace parecer que algo cabe cuando no. */
describe('barra de tu dinero', () => {
  it('con dinero libre: apartado + colchón + libre = lo que tienes, y la leyenda dice lo mismo', () => {
    const b = barraDinero({
      liquidez: 524_900,
      reservado: 284_900,
      colchon: 130_000,
      libre: 110_000,
      faltante: 0,
    });
    expect(b.total).toBe(524_900);
    expect(b.tramos.map((t) => [t.clave, t.centavos])).toEqual([
      ['apartado', 284_900],
      ['colchon', 130_000],
      ['libre', 110_000],
    ]);
    expect(b.tramos.reduce((s, t) => s + t.centavos, 0)).toBe(b.total);
    expect(b.leyenda).toEqual(b.tramos);
  });

  it('si no alcanza: lo que tienes cubre lo apartado y después el colchón; el resto es el faltante de E4, en su tramo', () => {
    // El escenario de Maestro: $600 en efectivo, colchón de $1,300 y nada apartado → «Te faltan $700».
    const b = barraDinero({
      liquidez: 60_000,
      reservado: 0,
      colchon: 130_000,
      libre: -70_000,
      faltante: 70_000,
    });
    expect(b.total).toBe(60_000);
    expect(b.tramos.map((t) => [t.clave, t.centavos])).toEqual([
      ['apartado', 0],
      ['colchon', 60_000],
      ['faltante', 70_000],
    ]);
    // La leyenda dice lo que pide cada parte (el colchón completo) y lo que falta.
    expect(b.leyenda.map((t) => [t.clave, t.centavos])).toEqual([
      ['apartado', 0],
      ['colchon', 130_000],
      ['faltante', 70_000],
    ]);
    // Lo cubierto más el faltante es todo lo que se pide: nunca parece que el colchón cabe en lo que tienes.
    const cubierto = b.tramos.filter((t) => t.clave !== 'faltante').reduce((s, t) => s + t.centavos, 0);
    expect(cubierto).toBe(60_000);
    expect(b.tramos.reduce((s, t) => s + t.centavos, 0)).toBe(130_000);
  });

  it('lo apartado va primero: si ni eso alcanza, el colchón queda sin cubrir', () => {
    const b = barraDinero({
      liquidez: 100_000,
      reservado: 150_000,
      colchon: 50_000,
      libre: -100_000,
      faltante: 100_000,
    });
    expect(b.tramos.map((t) => [t.clave, t.centavos])).toEqual([
      ['apartado', 100_000],
      ['colchon', 0],
      ['faltante', 100_000],
    ]);
  });

  it('con lo que tienes en negativo no hay nada cubierto: todo es faltante', () => {
    const b = barraDinero({
      liquidez: -20_000,
      reservado: 30_000,
      colchon: 0,
      libre: -50_000,
      faltante: 50_000,
    });
    expect(b.tramos.map((t) => [t.clave, t.centavos])).toEqual([
      ['apartado', 0],
      ['colchon', 0],
      ['faltante', 50_000],
    ]);
  });
});
