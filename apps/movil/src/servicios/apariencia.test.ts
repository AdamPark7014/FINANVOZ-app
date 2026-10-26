import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { APARIENCIA_POR_OMISION, fijarApariencia, obtenerApariencia } from './apariencia';
import { escribirAjuste } from './preferencias';
import { abrirPrueba } from './__pruebas__/base';

describe('Ajustes › Apariencia (02 §16)', () => {
  it('por omisión es claro, aunque el teléfono esté en oscuro', () => {
    const p = abrirPrueba();
    expect(APARIENCIA_POR_OMISION).toBe('claro');
    expect(obtenerApariencia(p.ctx)).toBe('claro');
  });

  it('la elección se guarda y se lee de vuelta', () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    fijarApariencia(p.ctx, 'oscuro');
    expect(obtenerApariencia(p.ctx)).toBe('oscuro');
    fijarApariencia(p.ctx, 'sistema');
    expect(obtenerApariencia(p.ctx)).toBe('sistema');
    fijarApariencia(p.ctx, 'claro');
    expect(obtenerApariencia(p.ctx)).toBe('claro');
  });

  it('un valor que esta versión no conoce se lee como claro', () => {
    const p = abrirPrueba();
    escribirAjuste(p.ctx, 'apariencia', z.unknown(), { apariencia: 'sepia' });
    expect(obtenerApariencia(p.ctx)).toBe('claro');
    escribirAjuste(p.ctx, 'apariencia', z.unknown(), 'oscuro');
    expect(obtenerApariencia(p.ctx)).toBe('claro');
  });

  it('sin el aviso de privacidad aceptado no se guarda', () => {
    const p = abrirPrueba();
    expect(() => fijarApariencia(p.ctx, 'oscuro')).toThrow(
      expect.objectContaining({ codigo: 'sin_consentimiento' }),
    );
    expect(obtenerApariencia(p.ctx)).toBe('claro');
  });
});
