import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Calculadora } from './Calculadora';

afterEach(cleanup);

function escribir(etiqueta: RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llenar(ingreso: string, deudas: string, msi: string, precio?: string, meses?: string) {
  escribir(/te llega al mes/i, ingreso);
  escribir(/pagas al mes de deudas/i, deudas);
  escribir(/cuánto es de meses sin intereses/i, msi);
  if (precio) escribir(/^precio$/i, precio);
  if (meses) fireEvent.change(screen.getByLabelText(/^meses$/i), { target: { value: meses } });
}

const texto = (prueba: string) => document.querySelector(`[data-prueba="${prueba}"]`)?.textContent ?? '';

describe('Calculadora', () => {
  it('CA-M0-02 · E10-01: capacidad $1,000, limitante MSI y "Sí cabe" con margen $0', () => {
    render(<Calculadora />);
    llenar('20,000', '3,000', '1,000', '12,000', '12');
    expect(texto('capacidad')).toContain('$1,000');
    expect(texto('limitante')).toMatch(/meses sin intereses/);
    expect(texto('veredicto')).toContain('Sí cabe');
    expect(texto('veredicto')).toContain('margen $0');
  });

  it('CA-M0-03 · E10-03: capacidad $0 y mensaje de que ya rebasa la recomendación', () => {
    render(<Calculadora />);
    llenar('15,000', '5,000', '2,000');
    expect(texto('capacidad')).toContain('$0');
    expect(texto('mensaje-tope')).toMatch(/ya rebasan la recomendación/);
  });

  it('E10-02: no cabe y dice por cuánto se pasa', () => {
    render(<Calculadora />);
    llenar('20000', '5500', '0', '12000', '12');
    expect(texto('veredicto')).toContain('No cabe');
    expect(texto('veredicto')).toContain('$500');
  });

  it('pide corregir MSI mayores que el total de deudas', () => {
    render(<Calculadora />);
    llenar('20000', '1000', '2000');
    expect(screen.getByText(/son parte de tus deudas/)).toBeTruthy();
  });

  it('CA-M0-07 · calcular no hace ninguna petición de red', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<Calculadora />);
    llenar('20,000', '3,000', '1,000', '12,000', '12');
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
