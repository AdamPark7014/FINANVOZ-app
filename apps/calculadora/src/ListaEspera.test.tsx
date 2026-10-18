import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('./config', () => ({
  MARCA: 'Finanvoz',
  VERSION_AVISO: 'prueba',
  LISTA_ESPERA_URL: 'https://ejemplo.supabase.co/functions/v1/lista-espera',
  RESPONSABLE: {
    nombre: 'Responsable de prueba',
    domicilio: 'Calle 1, CDMX',
    correo: 'privacidad@ejemplo.mx',
  },
  RESPONSABLE_DEFINIDO: true,
}));

const { ListaEspera } = await import('./ListaEspera');

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function contestar(correo: string) {
  fireEvent.change(screen.getByLabelText(/tu correo/i), { target: { value: correo } });
  for (const opcion of ['Android', 'Sí, siempre', 'De $50 a $99', 'Mi negocio o freelance']) {
    fireEvent.click(screen.getByLabelText(opcion));
  }
}

const enviar = () => fireEvent.click(screen.getByRole('button', { name: /anotarme/i }));

describe('Lista de espera', () => {
  it('CA-M0-05 · no envía sin consentimiento', () => {
    render(<ListaEspera />);
    contestar('ana@ejemplo.mx');
    enviar();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/aviso de privacidad/);
  });

  it('CA-M0-05 · rechaza correos inválidos', () => {
    render(<ListaEspera />);
    contestar('ana@ejemplo');
    fireEvent.click(screen.getByLabelText(/acepto/i));
    enviar();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/correo/);
  });

  it('envía solo correo, respuestas y consentimiento, sin montos', async () => {
    render(<ListaEspera />);
    contestar('ana@ejemplo.mx');
    fireEvent.click(screen.getByLabelText(/acepto/i));
    enviar();
    await waitFor(() => expect(screen.getByText(/ya estás en la lista/)).toBeTruthy());
    const cuerpo = JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(cuerpo).sort()).toEqual([
      'consentimiento',
      'correo',
      'respuestas',
      'sitio_web',
      'version_aviso',
    ]);
    expect(cuerpo['respuestas']).toEqual({
      telefono: 'android',
      notificaciones: 'si',
      precio: '50_99',
      uso: 'negocio',
    });
  });

  it('si falta una pregunta, dice cuál, la marca y lleva el foco a ella', () => {
    render(<ListaEspera />);
    fireEvent.change(screen.getByLabelText(/tu correo/i), { target: { value: 'ana@ejemplo.mx' } });
    for (const opcion of ['Android', 'De $50 a $99', 'Mi negocio o freelance']) {
      fireEvent.click(screen.getByLabelText(opcion));
    }
    fireEvent.click(screen.getByLabelText(/acepto/i));
    enviar();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'Falta contestar: ¿Tu banco te avisa con una notificación en cada compra?',
    );
    const grupo = screen.getByRole('radiogroup', { name: /tu banco te avisa/i });
    expect(grupo.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByRole('radiogroup', { name: /android o iphone/i }).getAttribute('aria-invalid'),
    ).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Sí, siempre'));

    fireEvent.click(screen.getByLabelText('A veces'));
    expect(grupo.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si faltan varias, dice cuántas y empieza por la primera', () => {
    render(<ListaEspera />);
    fireEvent.change(screen.getByLabelText(/tu correo/i), { target: { value: 'ana@ejemplo.mx' } });
    enviar();
    expect(screen.getByRole('alert').textContent).toBe(
      'Faltan 4 preguntas por contestar. Empieza por: ¿Usas Android o iPhone?',
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Android'));
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(4);
  });

  it('avisa cuando el servidor limita los intentos', async () => {
    fetch.mockResolvedValue({ ok: false, status: 429 });
    render(<ListaEspera />);
    contestar('ana@ejemplo.mx');
    fireEvent.click(screen.getByLabelText(/acepto/i));
    enviar();
    await waitFor(() => expect(screen.getByText(/varios intentos/)).toBeTruthy());
  });
});
