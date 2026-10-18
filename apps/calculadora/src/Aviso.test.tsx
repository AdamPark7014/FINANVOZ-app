import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Aviso } from './Aviso';
import { AVISO_COMPLETO } from './aviso-app';
import { VERSION_CONSENTIMIENTO } from './config';

afterEach(() => {
  cleanup();
});

describe('Aviso', () => {
  it('expone destino del skip link en el landmark principal', () => {
    render(<Aviso />);
    const main = screen.getByRole('main');
    expect(main.id).toBe('contenido-principal');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('muestra la versión alineada con la app y las secciones del aviso integral', () => {
    render(<Aviso />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Aviso de privacidad/);
    expect(screen.getByText(`Versión ${VERSION_CONSENTIMIENTO}`)).toBeTruthy();
    expect(VERSION_CONSENTIMIENTO).toBe('2026-10-m8');
    for (const s of AVISO_COMPLETO) {
      expect(screen.getByRole('heading', { name: s.titulo })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Esta página web (calculadora y lista de espera)' })).toBeTruthy();
  });
});
