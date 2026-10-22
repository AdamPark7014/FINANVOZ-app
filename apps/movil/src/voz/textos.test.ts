import { describe, expect, it } from 'vitest';
import {
  etiquetaMicrofonoCampo,
  MENSAJES_DICTADO_CAMPO,
  mensajeMontoAproximado,
  mensajeMontoNoEntendido,
  mensajeMontoOido,
  textoOyendoCampo,
} from './textos';

describe('textos del dictado en un campo de dinero (02-UX §14)', () => {
  it('dice qué oyó y qué cifra puso', () => {
    expect(mensajeMontoOido('ocho mil quinientos', '$8,500')).toBe('Oí «ocho mil quinientos»: puse $8,500.');
    expect(mensajeMontoNoEntendido('hola')).toBe('No entendí la cifra en «hola». Dila otra vez o escríbela.');
  });

  it('cita la palabra que hizo aproximada la cifra; si no la encuentra, la frase', () => {
    expect(mensajeMontoAproximado('como quinientos')).toBe(
      'Dijiste «como»: corrígelo si sabes la cifra exacta.',
    );
    expect(mensajeMontoAproximado('son más o menos 1,200')).toBe(
      'Dijiste «más o menos»: corrígelo si sabes la cifra exacta.',
    );
    expect(mensajeMontoAproximado('mil y pico')).toBe(
      'Dijiste «y pico»: corrígelo si sabes la cifra exacta.',
    );
    expect(mensajeMontoAproximado('Unos 300')).toBe('Dijiste «Unos»: corrígelo si sabes la cifra exacta.');
    expect(mensajeMontoAproximado('trescientos')).toBe(
      'Dijiste «trescientos»: corrígelo si sabes la cifra exacta.',
    );
  });

  it('mientras escucha muestra lo oído; sin nada aún, "Te escucho…"', () => {
    expect(textoOyendoCampo('')).toBe('Te escucho…');
    expect(textoOyendoCampo('ocho mil')).toBe('«ocho mil»');
  });

  it('los mensajes del campo no hablan de gastos ni de registrar, y no traen signos de exclamación', () => {
    for (const m of Object.values(MENSAJES_DICTADO_CAMPO)) {
      expect(m).not.toMatch(/gasto|registr|!|¡|por favor/i);
    }
    expect(etiquetaMicrofonoCampo('Monto')).toBe('Dictar en voz: Monto');
  });
});
