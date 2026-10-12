import { describe, expect, it } from 'vitest';
import { extraerCifras, validarCifras } from './cifras';

const RESULTADOS = [
  '{"texto":"Vas $1,850 arriba en comida que a estas alturas del mes pasado.","lineas":[{"etiqueta":"Del 1 al 11 oct","valor":"$2,300"},{"etiqueta":"Del 1 al 11 sep","valor":"$450"}]}',
  '{"texto":"Del 1 al 11 oct llevas $1,099.90 en transporte (12 movimientos)."}',
];

describe('extraerCifras', () => {
  it('normaliza comas, centavos en cero y ceros a la izquierda', () => {
    expect(extraerCifras('$1,850 · $1850.00 · 1,099.90 · 05 · 3.5% · 12.')).toEqual([
      '1850',
      '1850',
      '1099.9',
      '5',
      '3.5',
      '12',
    ]);
  });
});

describe('validarCifras (06 §6, regla 4)', () => {
  it('pasa cuando cada cifra está en un resultado, aunque cambie el formato', () => {
    const r = validarCifras(
      'Gastaste $1,850 más en comida: $2,300 contra $450. En transporte llevas $1,099.90 (12 movimientos) del 1 al 11 oct.',
      RESULTADOS,
    );
    expect(r).toEqual({ ok: true, cifras: ['1850', '2300', '450', '1099.9', '12', '1', '11'] });
    expect(validarCifras('Gastaste $1850 más en comida.', RESULTADOS).ok).toBe(true);
    expect(validarCifras('No encontré gastos que lo expliquen.', RESULTADOS).ok).toBe(true);
  });

  it('rechaza una cifra inventada o calculada (suma, redondeo, porcentaje)', () => {
    expect(validarCifras('Gastaste $1,851 más en comida.', RESULTADOS)).toEqual({
      ok: false,
      motivo: 'cifra_ajena',
    });
    // $2,300 + $450 = $2,750 no está en ningún resultado.
    expect(validarCifras('Entre los dos meses van $2,750.', RESULTADOS).ok).toBe(false);
    expect(validarCifras('Unos $1,100 en transporte.', RESULTADOS).ok).toBe(false);
    expect(validarCifras('Subió 411% tu gasto en comida.', RESULTADOS).ok).toBe(false);
  });

  it('rechaza cantidades con letras y proporciones; permite "un", "una" y palabras que las contienen', () => {
    expect(validarCifras('Hiciste doce compras de comida.', RESULTADOS)).toEqual({
      ok: false,
      motivo: 'cifra_en_letras',
    });
    expect(validarCifras('Gastaste casi el doble en comida.', RESULTADOS).ok).toBe(false);
    expect(validarCifras('Fueron mil pesos más.', RESULTADOS).ok).toBe(false);
    expect(validarCifras('Gastaste doscientos más.', RESULTADOS).ok).toBe(false);
    expect(
      validarCifras('En una quincena todos tus gastos de comida subieron $1,850 por un antojo.', RESULTADOS)
        .ok,
    ).toBe(true);
  });

  it('rechaza la respuesta vacía', () => {
    expect(validarCifras('  ', RESULTADOS)).toEqual({ ok: false, motivo: 'vacia' });
  });
});
