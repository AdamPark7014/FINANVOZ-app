import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Calculadora, RETRASO_ANUNCIO_MS } from './Calculadora';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    expect(texto('veredicto')).toContain('no te sobra nada ($0 al mes)');
  });

  it('CA-M0-03 · E10-03: capacidad $0 y mensaje de que ya rebasa la recomendación', () => {
    render(<Calculadora />);
    llenar('15,000', '5,000', '2,000');
    expect(texto('capacidad')).toContain('$0');
    expect(texto('mensaje-tope')).toMatch(/ya te pasas de lo recomendado/);
  });

  it('E10-02: no cabe y dice por cuánto se pasa', () => {
    render(<Calculadora />);
    llenar('20000', '5500', '0', '12000', '12');
    expect(texto('veredicto')).toContain('No cabe');
    expect(texto('veredicto')).toContain('Te pasas por $500 al mes');
  });

  it('pide corregir MSI mayores que el total de deudas al salir del campo', () => {
    render(<Calculadora />);
    llenar('20000', '1000', '2000');
    expect(screen.queryByText(/son parte de tus deudas/)).toBeNull();
    fireEvent.blur(screen.getByLabelText(/cuánto es de meses sin intereses/i));
    expect(screen.getByText(/son parte de tus deudas/)).toBeTruthy();
  });

  it('el error de formato no aparece mientras escribes, sino al salir del campo', () => {
    render(<Calculadora />);
    const campo = screen.getByLabelText(/te llega al mes/i);
    escribir(/te llega al mes/i, '20,0');
    expect(screen.queryByText(/Escribe solo números/)).toBeNull();
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    fireEvent.blur(campo);
    expect(screen.getByText(/Escribe solo números/)).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    escribir(/te llega al mes/i, '20,000');
    expect(screen.queryByText(/Escribe solo números/)).toBeNull();
  });

  it('el lector de pantalla oye una sola línea, cuando dejas de escribir', () => {
    vi.useFakeTimers();
    render(<Calculadora />);
    llenar('20000', '3000', '0', '6000', '12');
    const anuncio = screen.getByRole('status');
    expect(anuncio.getAttribute('aria-live')).toBe('polite');
    expect(anuncio.textContent).toBe('');
    act(() => vi.advanceTimersByTime(RETRASO_ANUNCIO_MS));
    expect(anuncio.textContent).toBe('Sí cabe: te sobran $1,500 al mes.');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
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
