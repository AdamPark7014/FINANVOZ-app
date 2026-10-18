import { describe, expect, it } from 'vitest';
import { CORREO_AYUDA } from './preguntas';
import {
  ACCESIBILIDAD_ESCRIBIR_CORREO,
  ACCESIBILIDAD_VOLVER,
  BTN_ABRIR_DESDE_AJUSTES,
  BTN_AYUDA,
  etiquetaAccesibleCuerpoContacto,
  etiquetaAccesibleIntro,
  etiquetaAccesibleParrafoRespuesta,
  etiquetaAccesibleSinAppCorreo,
  ETIQUETA_RESPUESTA,
  ICONO_PREGUNTA_ABIERTA,
  ICONO_PREGUNTA_CERRADA,
  INTRO,
  PISTA_ABRIR_DESDE_AJUSTES,
  PISTA_ESCRIBIR_CORREO,
  PISTA_VOLVER,
  PREGUNTAS_TITULO,
  SECCION_AJUSTES,
  SECCION_AYUDA,
  TEXTO_AYUDA,
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
    expect(SECCION_AYUDA).toBe(SECCION_AJUSTES);
    expect(TEXTO_AYUDA).toBe(TEXTO_CARD_AJUSTES);
    expect(BTN_AYUDA).toBe(BTN_ABRIR_DESDE_AJUSTES);
    expect(INTRO).toMatch(/Toca una pregunta/);
  });

  it('iconos de expandir y mensajes de contacto son estables', () => {
    expect(ICONO_PREGUNTA_CERRADA).toBe('+');
    expect(ICONO_PREGUNTA_ABIERTA).toBe('−');
    expect(pistaPreguntaFrecuente(false)).toMatch(/Despliega/);
    expect(pistaPreguntaFrecuente(true)).toMatch(/Pliega/);
    expect(textoCuerpoContacto(CORREO_AYUDA)).toContain(CORREO_AYUDA);
    expect(mensajeSinAppCorreo(CORREO_AYUDA)).toContain(CORREO_AYUDA);
  });

  it('TalkBack: pistas, etiquetas accesibles y región de respuesta', () => {
    expect(PISTA_VOLVER).toMatch(/Ajustes/);
    expect(ACCESIBILIDAD_VOLVER).toMatch(/ajustes/i);
    expect(PISTA_ABRIR_DESDE_AJUSTES).toMatch(/preguntas frecuentes/i);
    expect(PISTA_ESCRIBIR_CORREO).toMatch(/correo/i);
    expect(ACCESIBILIDAD_ESCRIBIR_CORREO).toMatch(/correo/i);
    expect(ETIQUETA_RESPUESTA).toBe('Respuesta');
    expect(PREGUNTAS_TITULO).toMatch(/Preguntas frecuentes/);
    expect(etiquetaAccesibleCuerpoContacto(CORREO_AYUDA)).toMatch(/arroba/);
    expect(etiquetaAccesibleCuerpoContacto(CORREO_AYUDA)).not.toContain('@');
    expect(etiquetaAccesibleSinAppCorreo(CORREO_AYUDA)).toMatch(/arroba/);
    expect(etiquetaAccesibleParrafoRespuesta('Hola.', true)).toMatch(/^Respuesta\./);
    expect(etiquetaAccesibleParrafoRespuesta('Hola.', false)).toBe('Hola.');
    expect(etiquetaAccesibleIntro()).toBe(INTRO);
    expect(etiquetaAccesibleParrafoRespuesta('Ve a Ajustes › Captura.', true)).toMatch(/sección Captura/);
    expect(etiquetaAccesibleParrafoRespuesta('Espera 48 h.', false)).toMatch(/cuarenta y ocho horas/);
  });
});
