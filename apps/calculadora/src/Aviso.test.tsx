import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aviso } from './Aviso';
import { AVISO_COMPLETO } from './aviso-app';
import { VERSION_CONSENTIMIENTO } from './config';

describe('Aviso', () => {
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
