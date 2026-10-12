import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESPONSABLE } from './pantallas/onboarding/aviso';
import { TEXTO_NO_ASESORIA } from './pantallas/privacidad/legales';

/**
 * Ficha de Google Play (`docs/tienda`, M13): los textos que se pegan en Play Console caben en los límites de la
 * consola y siguen `02 §14` y `08 §1`. Play cuenta caracteres, no bytes: se mide en puntos de código.
 */

const TIENDA = fileURLToPath(new URL('../../../docs/tienda/', import.meta.url));
const leer = (archivo: string) => readFileSync(`${TIENDA}${archivo}`, 'utf8').replace(/\n$/, '');
const largo = (texto: string) => [...texto].length;

const titulo = leer('titulo.txt');
const corta = leer('descripcion-corta.txt');
const completa = leer('descripcion-completa.txt');
const notas = leer('notas-version-1.0.0.txt');

describe('límites de Play Console', () => {
  it.each([
    { archivo: 'titulo.txt', texto: titulo, limite: 30 },
    { archivo: 'descripcion-corta.txt', texto: corta, limite: 80 },
    { archivo: 'descripcion-completa.txt', texto: completa, limite: 4000 },
    { archivo: 'notas-version-1.0.0.txt', texto: notas, limite: 500 },
  ])('$archivo cabe en $limite caracteres', ({ texto, limite }) => {
    expect(texto.trim()).not.toBe('');
    expect(largo(texto)).toBeLessThanOrEqual(limite);
    expect(texto).toBe(texto.trim());
  });

  it('el título y la descripción breve son de una línea', () => {
    expect(titulo).not.toMatch(/\n/);
    expect(corta).not.toMatch(/\n/);
  });
});

describe('reglas del texto', () => {
  const todos = [titulo, corta, completa, notas];

  it('sin exclamaciones, emojis ni precios', () => {
    for (const t of todos) {
      expect(t).not.toMatch(/[!¡]/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\$\s?\d|MXN|al mes por|\/mes/);
    }
  });

  it('sin términos promocionales que Play no permite en el título ni en la descripción breve', () => {
    for (const t of [titulo, corta]) {
      expect(t).not.toMatch(/gratis|gratuit|mejor|#1|\btop\b|nuev[oa]|oferta|descuento|promoci/i);
    }
  });

  it('nada que suene a asesoría financiera ni a promesa de resultados (`08 §1`)', () => {
    const prohibidas =
      /ahorra|inversi[oó]n(?!es)|invierte|recomendamos|te recomienda|garantizad|garantiza(?!n resultados)|mejora tu (historial|cr[eé]dito|score)|sin riesgo|asesor(?! de inversiones)/i;
    for (const t of todos) expect(t).not.toMatch(prohibidas);
  });

  it('la descripción completa lleva el texto fijo de Acerca de, el aviso de deducciones y el correo de contacto', () => {
    expect(completa).toContain(TEXTO_NO_ASESORIA);
    expect(completa).toMatch(/no sustituyen a tu contador/);
    expect(completa).toContain(RESPONSABLE.correo);
  });

  it('la privacidad dice lo que sale del teléfono, igual que el centro de privacidad (`08 §3.2`)', () => {
    expect(completa).toMatch(/movimientos se guardan cifrados en tu teléfono/);
    expect(completa).toMatch(/avisos de tu banco se procesan en tu teléfono y no se envían/);
    expect(completa).toMatch(/proveedor de inteligencia artificial/);
    expect(completa).toMatch(/reportes de errores no llevan montos/);
    expect(completa).toMatch(/estadísticas de uso son opcionales/);
  });

  it('usa la marca Finanvoz, no el nombre de trabajo "Cartera"', () => {
    expect(titulo.startsWith('Finanvoz')).toBe(true);
    for (const t of todos) expect(t).not.toMatch(/\bCartera\b/);
  });
});
