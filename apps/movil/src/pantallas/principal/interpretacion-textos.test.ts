import { describe, expect, it } from 'vitest';
import {
  MENSAJE_LIMITE_MENSUAL_GRATIS,
  MENSAJE_LIMITE_MENSUAL_PLUS,
} from '../plan/textos';
import {
  esMensajeRegistroAlerta,
  etiquetaBotonElegirMovimiento,
  MENSAJE_EXPLICAR_SIN_RED,
  TITULO_DUPLICADOS,
  TITULO_ELEGIR_MOVIMIENTO,
} from './textos';

describe('principal/textos · interpretación', () => {
  it('títulos de elegir movimiento en tuteo', () => {
    expect(TITULO_ELEGIR_MOVIMIENTO.corregir).toMatch(/\?$/);
    expect(TITULO_DUPLICADOS).toMatch(/repetido/i);
  });

  it('botón de anular dice Borrar', () => {
    expect(etiquetaBotonElegirMovimiento('anular')).toBe('Borrar');
    expect(etiquetaBotonElegirMovimiento('corregir')).toBe('Guardar');
  });

  it('esMensajeRegistroAlerta incluye cupo y errores de explicar', () => {
    expect(esMensajeRegistroAlerta(MENSAJE_EXPLICAR_SIN_RED)).toBe(true);
    expect(esMensajeRegistroAlerta(MENSAJE_LIMITE_MENSUAL_GRATIS)).toBe(true);
    expect(esMensajeRegistroAlerta(MENSAJE_LIMITE_MENSUAL_PLUS)).toBe(true);
    expect(esMensajeRegistroAlerta('Lo guardé; lo interpreto cuando tengas internet.')).toBe(false);
  });
});
