import { describe, expect, it } from 'vitest';
import { BTN_INVITACION_AVISOS_SI, TITULO_INVITACION_AVISOS } from './textos';

describe('avisos/textos', () => {
  it('invitación en tuteo y con signos de pregunta donde corresponde', () => {
    expect(TITULO_INVITACION_AVISOS).toMatch(/\?$/);
    expect(BTN_INVITACION_AVISOS_SI).toMatch(/avísame/i);
  });
});
