import { describe, expect, it } from 'vitest';
import {
  RESPUESTA_AYUDA,
  RESPUESTA_GRACIAS,
  RESPUESTA_QUIEN,
  RESPUESTA_SALUDO,
  respuestaCharla,
} from './charla';

describe('charla del asistente sin nube', () => {
  it('saludos, gracias, ayuda y quién eres, con o sin signos y acentos', () => {
    expect(respuestaCharla('Hola')).toBe(RESPUESTA_SALUDO);
    expect(respuestaCharla('¡Buenos días!')).toBe(RESPUESTA_SALUDO);
    expect(respuestaCharla('muchas gracias.')).toBe(RESPUESTA_GRACIAS);
    expect(respuestaCharla('¿Qué puedes hacer?')).toBe(RESPUESTA_AYUDA);
    expect(respuestaCharla('¿quién eres?')).toBe(RESPUESTA_QUIEN);
  });

  it('una frase con algo más no es charla: sigue al intérprete', () => {
    expect(respuestaCharla('hola, tacos 80 en efectivo')).toBeNull();
    expect(respuestaCharla('gracias por los 500 que me prestaste')).toBeNull();
    expect(respuestaCharla('')).toBeNull();
  });

  it('textos de asistente: tuteo, sin exclamaciones ni consejos y cortos', () => {
    for (const t of [RESPUESTA_AYUDA, RESPUESTA_GRACIAS, RESPUESTA_QUIEN, RESPUESTA_SALUDO]) {
      expect(t).not.toMatch(/[¡!]/);
      expect(t).not.toMatch(/\busted\b|deberías|te recomiendo/i);
      expect(t.length).toBeLessThanOrEqual(180);
    }
  });
});
