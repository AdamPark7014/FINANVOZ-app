import { describe, expect, it } from 'vitest';
import { CORREO_AYUDA } from './preguntas';
import {
  BTN_ABRIR_DESDE_AJUSTES,
  BTN_AYUDA,
  ICONO_PREGUNTA_ABIERTA,
  ICONO_PREGUNTA_CERRADA,
  INTRO,
  SECCION_AJUSTES,
  TEXTO_CARD_AJUSTES,
  TITULO,
  mensajeSinAppCorreo,
  pistaPreguntaFrecuente,
  textoCuerpoContacto,
} from './textos';

describe('textos de ayuda', () => {
  it('la pantalla y el bloque de Ajustes comparten título y copy fijo', () => {
    expect(SECCION_AJUSTES).toBe(TITULO);
    expect(TEXTO_CARD_AJUSTES).toMatch(/correo de contacto/);
    expect(BTN_ABRIR_DESDE_AJUSTES).toMatch(/preguntas frecuentes/i);
    expect(INTRO).toMatch(/Toca una pregunta/);
  });

  it('iconos de expandir y mensajes de contacto son estables', () => {
    expect(ICONO_PREGUNTA_CERRADA).toBe('+');
    expect(ICONO_PREGUNTA_ABIERTA).toBe('−');
    expect(pistaPreguntaFrecuente(false)).toMatch(/Muestra/);
    expect(pistaPreguntaFrecuente(true)).toMatch(/Oculta/);
    expect(textoCuerpoContacto(CORREO_AYUDA)).toContain(CORREO_AYUDA);
    expect(mensajeSinAppCorreo(CORREO_AYUDA)).toContain(CORREO_AYUDA);
  });
});
