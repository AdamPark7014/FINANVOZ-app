import { describe, expect, it } from 'vitest';
import {
  PREFIJO_REPETIR,
  RESPUESTA_AFIRMACION,
  RESPUESTA_APARTADO,
  RESPUESTA_AYUDA,
  RESPUESTA_AYUDA_PREGUNTAS,
  RESPUESTA_COLCHON,
  RESPUESTA_DESPEDIDA,
  RESPUESTA_ESTADO,
  RESPUESTA_GRACIAS,
  RESPUESTA_LIBRE,
  RESPUESTA_PNGI,
  RESPUESTA_QUEJA,
  RESPUESTA_QUIEN,
  RESPUESTA_REPETIR_SIN,
  RESPUESTA_SALUDO,
  respuestaCharla,
} from './charla';
import { ultimaRespuesta } from './conversacion';

const TODAS = [
  RESPUESTA_AYUDA,
  RESPUESTA_GRACIAS,
  RESPUESTA_QUIEN,
  RESPUESTA_SALUDO,
  RESPUESTA_DESPEDIDA,
  RESPUESTA_AFIRMACION,
  RESPUESTA_ESTADO,
  RESPUESTA_AYUDA_PREGUNTAS,
  RESPUESTA_QUEJA,
  RESPUESTA_COLCHON,
  RESPUESTA_APARTADO,
  RESPUESTA_LIBRE,
  RESPUESTA_PNGI,
  RESPUESTA_REPETIR_SIN,
];

describe('charla del asistente sin nube', () => {
  it('saludos, gracias, ayuda y quién eres, con o sin signos y acentos', () => {
    expect(respuestaCharla('Hola')).toBe(RESPUESTA_SALUDO);
    expect(respuestaCharla('¡Buenos días!')).toBe(RESPUESTA_SALUDO);
    expect(respuestaCharla('muchas gracias.')).toBe(RESPUESTA_GRACIAS);
    expect(respuestaCharla('¿Qué puedes hacer?')).toBe(RESPUESTA_AYUDA);
    expect(respuestaCharla('¿quién eres?')).toBe(RESPUESTA_QUIEN);
  });

  it('despedida, «ok», cómo estás, qué preguntar, queja y conceptos', () => {
    expect(respuestaCharla('Adiós')).toBe(RESPUESTA_DESPEDIDA);
    expect(respuestaCharla('ok')).toBe(RESPUESTA_AFIRMACION);
    expect(respuestaCharla('¿Cómo estás?')).toBe(RESPUESTA_ESTADO);
    expect(respuestaCharla('¿Qué le puedo preguntar?')).toBe(RESPUESTA_AYUDA_PREGUNTAS);
    expect(respuestaCharla('no sirves')).toBe(RESPUESTA_QUEJA);
    expect(respuestaCharla('¿Qué es el colchón?')).toBe(RESPUESTA_COLCHON);
    expect(respuestaCharla('¿y lo libre?')).toBe(RESPUESTA_LIBRE);
  });

  it('«no entendí» o «¿mande?» repite lo último que dijo el asistente', () => {
    expect(respuestaCharla('¿mande?', 'Hoy puedes gastar $214.')).toBe(
      `${PREFIJO_REPETIR}Hoy puedes gastar $214.`,
    );
    expect(respuestaCharla('no entendí')).toBe(RESPUESTA_REPETIR_SIN);
    expect(
      ultimaRespuesta([
        { id: 'a', de: 'asistente', clase: 'texto', texto: 'Esta semana llevas $1,240.' },
        { id: 'b', de: 'persona', texto: 'no entendí', porVoz: true },
      ]),
    ).toBe('Esta semana llevas $1,240.');
    expect(ultimaRespuesta([])).toBeNull();
  });

  it('una frase con algo más no es charla: sigue al intérprete', () => {
    expect(respuestaCharla('hola, tacos 80 en efectivo')).toBeNull();
    expect(respuestaCharla('gracias por los 500 que me prestaste')).toBeNull();
    expect(respuestaCharla('')).toBeNull();
  });

  it('textos de asistente: tuteo, sin exclamaciones, cifras ni consejos y cortos', () => {
    for (const t of TODAS) {
      expect(t).not.toMatch(/[¡!]/);
      expect(t).not.toMatch(/\busted\b|deberías|te recomiendo|ahorra/i);
      expect(t).not.toMatch(/\$\d/);
      expect(t.length).toBeLessThanOrEqual(180);
    }
  });
});
