import { describe, expect, it } from 'vitest';
import { mensajePagoPlaneadoApartado, tituloCompraMsiMeses, TITULO_CONFIRMAR_MSI } from './textos';

describe('tarjetas/textos · confirmar MSI', () => {
  it('título de compra incluye meses', () => {
    expect(tituloCompraMsiMeses(12)).toBe('Compra a 12 meses sin intereses');
  });

  it('motivo monto alto coincide con confirmación de registro', () => {
    expect(TITULO_CONFIRMAR_MSI.monto_alto).toMatch(/Revísalo/);
  });

  it('aviso al apartar pago planeado incluye el monto', () => {
    expect(mensajePagoPlaneadoApartado(50_000)).toBe('Listo: aparto $500.00 para cada pago planeado.');
  });
});
