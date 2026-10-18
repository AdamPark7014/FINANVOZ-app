import { describe, expect, it } from 'vitest';
import {
  LISTA_ESPERA_ARIA_CTA,
  LISTA_ESPERA_ARIA_CTA_ENVIANDO,
  LISTA_ESPERA_ARIA_FORMULARIO,
  LISTA_ESPERA_CONSENTIMIENTO,
  LISTA_ESPERA_CTA,
  LISTA_ESPERA_ERROR_CONSENTIMIENTO,
  LISTA_ESPERA_ERROR_CORREO,
  LISTA_ESPERA_ERROR_LIMITE,
  LISTA_ESPERA_ERROR_RED,
  LISTA_ESPERA_PREGUNTAS,
  LISTA_ESPERA_TITULO,
  LISTA_ESPERA_TITULO_EXITO,
  listaEsperaAvisoBreve,
  listaEsperaErrorFaltaUna,
  listaEsperaErrorFaltanVarias,
  listaEsperaIntro,
  listaEsperaTextoExito,
} from './textos';

const COPY_FIJO = [
  LISTA_ESPERA_TITULO,
  LISTA_ESPERA_ARIA_FORMULARIO,
  LISTA_ESPERA_ERROR_CORREO,
  LISTA_ESPERA_ERROR_CONSENTIMIENTO,
  LISTA_ESPERA_CONSENTIMIENTO,
  LISTA_ESPERA_ERROR_RED,
  LISTA_ESPERA_ERROR_LIMITE,
  LISTA_ESPERA_CTA,
  LISTA_ESPERA_TITULO_EXITO,
  listaEsperaIntro('Finanvoz'),
  listaEsperaTextoExito('Finanvoz'),
  listaEsperaErrorFaltaUna(LISTA_ESPERA_PREGUNTAS[1]!.texto),
  listaEsperaErrorFaltanVarias(4, LISTA_ESPERA_PREGUNTAS[0]!.texto),
  listaEsperaAvisoBreve(true, {
    nombre: 'NEXARA',
    domicilio: 'CDMX',
    correo: 'privacidad@ejemplo.mx',
  }),
];

describe('textos · lista de espera', () => {
  it('redacción es-MX: tuteo, sin exclamaciones ni “exitosamente”', () => {
    for (const texto of COPY_FIJO) {
      expect(texto).not.toMatch(/!/);
      expect(texto.toLowerCase()).not.toContain('exitosamente');
      expect(texto.toLowerCase()).not.toMatch(/\busted\b/);
    }
    for (const p of LISTA_ESPERA_PREGUNTAS) {
      expect(p.texto).not.toMatch(/!/);
      for (const [, etiqueta] of p.opciones) {
        expect(etiqueta).not.toMatch(/!/);
      }
    }
  });

  it('aria-labels del CTA en español de México', () => {
    expect(LISTA_ESPERA_ARIA_CTA).toMatch(/lista de espera/i);
    expect(LISTA_ESPERA_ARIA_CTA_ENVIANDO).toMatch(/enviando/i);
    expect(LISTA_ESPERA_ARIA_CTA).not.toMatch(/submit|sign up/i);
  });

  it('las cuatro preguntas coinciden con el contrato del servidor', () => {
    expect(LISTA_ESPERA_PREGUNTAS.map((p) => p.clave)).toEqual([
      'telefono',
      'notificaciones',
      'precio',
      'uso',
    ]);
  });
});
