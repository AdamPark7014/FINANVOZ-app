import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PaginaVenta } from './PaginaVenta';

afterEach(() => cleanup());

describe('PaginaVenta', () => {
  it('renderiza las secciones pedidas y abre el formulario de asesor', () => {
    render(<PaginaVenta />);
    expect(screen.getByRole('heading', { name: /dile qué gastaste/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /dos toques/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /tu tiendita, tu estética o tu taller/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /empieza gratis/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^privacidad$/i })).toBeTruthy();
    expect(screen.getAllByText(/ejemplo ilustrativo/i).length).toBeGreaterThan(0);
    // Precio de Plus sale de la configuración, con formato de dinero.
    expect(screen.getAllByText(/\$99/).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /hoy puedes gastar 412 pesos/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /hablar con un asesor/i }));
    expect(screen.getByRole('heading', { name: /hablar con un asesor/i })).toBeTruthy();
    expect(screen.getByLabelText(/^nombre$/i)).toBeTruthy();
  });
});
