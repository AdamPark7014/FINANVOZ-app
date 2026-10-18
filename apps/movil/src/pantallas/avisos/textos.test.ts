import { describe, expect, it } from 'vitest';
import {
  BTN_INVITACION_AVISOS_NO,
  BTN_INVITACION_AVISOS_SI,
  CUERPO_INVITACION_AVISOS,
  etiquetaAccesibleInvitacionAvisos,
  PISTA_INVITACION_AVISOS_NO,
  PISTA_INVITACION_AVISOS_SI,
  TITULO_INVITACION_AVISOS,
} from './textos';

describe('avisos/textos', () => {
  it('invitación en tuteo y con signos de pregunta donde corresponde', () => {
    expect(TITULO_INVITACION_AVISOS).toMatch(/\?$/);
    expect(BTN_INVITACION_AVISOS_SI).toMatch(/avísame/i);
    expect(CUERPO_INVITACION_AVISOS).toMatch(/\btu teléfono\b/i);
    expect(CUERPO_INVITACION_AVISOS).not.toMatch(/\busted\b/i);
  });

  it('pistas TalkBack sin exclamaciones y «Ahora no» apunta a Ajustes', () => {
    const ui = [PISTA_INVITACION_AVISOS_SI, PISTA_INVITACION_AVISOS_NO, BTN_INVITACION_AVISOS_NO].join('\n');
    expect(ui).not.toMatch(/[!¡]/);
    expect(PISTA_INVITACION_AVISOS_NO).toMatch(/Ajustes/i);
    expect(PISTA_INVITACION_AVISOS_SI).toMatch(/permiso/i);
  });

  it('etiqueta accesible junta título y cuerpo con el 3 en palabras', () => {
    expect(etiquetaAccesibleInvitacionAvisos()).toMatch(/tres días/i);
    expect(etiquetaAccesibleInvitacionAvisos()).toContain(TITULO_INVITACION_AVISOS);
  });
});
