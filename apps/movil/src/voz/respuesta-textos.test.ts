import { describe, expect, it } from 'vitest';
import { fraseRespuestaVoz } from './respuesta-textos';

describe('fraseRespuestaVoz', () => {
  it('dice lo registrado como se oye y cuánto puedes gastar hoy', () => {
    expect(fraseRespuestaVoz('Registré: Tacos $80 · Comida fuera · Nu ••4410', 20_750)).toBe(
      'Registré: Tacos ochenta pesos, Comida fuera, Nu terminación 4410. Hoy puedes gastar doscientos siete pesos.',
    );
  });

  it('sin cifra de hoy solo dice el mensaje; nunca dice una cifra negativa', () => {
    expect(fraseRespuestaVoz('Esta semana llevas $1,240 en comida.', null)).toBe(
      'Esta semana llevas mil doscientos cuarenta pesos en comida.',
    );
    expect(fraseRespuestaVoz('Listo.', -5_000)).toBe('Listo. Hoy puedes gastar cero pesos.');
  });
});
