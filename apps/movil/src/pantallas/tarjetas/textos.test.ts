import { describe, expect, it } from 'vitest';
import { tituloCompraMsiMeses, TITULO_CONFIRMAR_MSI } from './textos';

describe('tarjetas/textos · confirmar MSI', () => {
  it('título de compra incluye meses', () => {
    expect(tituloCompraMsiMeses(12)).toBe('Compra a 12 meses sin intereses');
  });

  it('motivo monto alto coincide con confirmación de registro', () => {
    expect(TITULO_CONFIRMAR_MSI.monto_alto).toMatch(/Revísalo/);
  });
});
