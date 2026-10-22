import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Soporte, enlaceCorreoAyuda } from './Soporte';
import { ASUNTO_CORREO_AYUDA, PREGUNTAS_FRECUENTES } from './ayuda-app';
import { RESPONSABLE } from './config';

afterEach(() => {
  cleanup();
});

describe('Soporte', () => {
  it('expone destino del skip link en el landmark principal', () => {
    render(<Soporte />);
    const main = screen.getByRole('main');
    expect(main.id).toBe('contenido-principal');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('lleva las diez preguntas de Ajustes › Ayuda, sus variantes de iPhone y el correo de contacto', () => {
    render(<Soporte />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Ayuda y soporte/);
    expect(PREGUNTAS_FRECUENTES).toHaveLength(10);
    for (const p of PREGUNTAS_FRECUENTES) {
      expect(screen.getByRole('heading', { level: 3, name: p.pregunta })).toBeTruthy();
      // Un párrafo puede repetirse en la variante de iPhone: basta con que aparezca.
      for (const parrafo of p.respuesta) expect(screen.getAllByText(parrafo).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/^En iPhone:/).length).toBe(
      PREGUNTAS_FRECUENTES.filter((p) => p.iphone).length,
    );
    const correos = screen.getAllByRole('link', { name: RESPONSABLE.correo });
    expect(correos.length).toBeGreaterThan(0);
    expect(correos[0]?.getAttribute('href')).toBe(enlaceCorreoAyuda());
    expect(enlaceCorreoAyuda()).toBe(
      `mailto:${RESPONSABLE.correo}?subject=${encodeURIComponent(ASUNTO_CORREO_AYUDA)}`,
    );
    expect(screen.getByRole('link', { name: 'aviso de privacidad' }).getAttribute('href')).toBe(
      './aviso-de-privacidad.html',
    );
  });

  it('sigue las reglas del copy: tuteo sin signos de exclamación ni promesas (`02 §14`, `08 §1`)', () => {
    for (const p of PREGUNTAS_FRECUENTES) {
      for (const t of [p.pregunta, ...p.respuesta, ...(p.iphone ?? [])]) {
        expect(t).not.toMatch(/[!¡]/);
        expect(t).not.toMatch(/ahorra|garantizad|recomendamos|mejora tu (historial|cr[eé]dito)/i);
      }
    }
  });
});
