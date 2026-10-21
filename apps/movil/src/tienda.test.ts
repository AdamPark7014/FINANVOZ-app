import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESPONSABLE } from './pantallas/onboarding/aviso';
import { TEXTO_NO_ASESORIA } from './pantallas/privacidad/legales';

/**
 * Fichas de Google Play (`docs/tienda`) y de App Store (`docs/tienda/ios`), M13: los textos que se pegan en Play
 * Console y en App Store Connect caben en los límites de cada consola y siguen `02 §14` y `08 §1`. Las tiendas
 * cuentan caracteres, no bytes: se mide en puntos de código.
 */

const TIENDA = fileURLToPath(new URL('../../../docs/tienda/', import.meta.url));
const leer = (archivo: string) => readFileSync(`${TIENDA}${archivo}`, 'utf8').replace(/\n$/, '');
const largo = (texto: string) => [...texto].length;

const titulo = leer('titulo.txt');
const corta = leer('descripcion-corta.txt');
const completa = leer('descripcion-completa.txt');
const notas = leer('notas-version-1.0.0.txt');

const subtitulo = leer('ios/subtitulo.txt');
const promocional = leer('ios/texto-promocional.txt');
const descripcionIos = leer('ios/descripcion.txt');
const palabrasClave = leer('ios/palabras-clave.txt');
const notasRevision = leer('ios/notas-revision.txt');

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

describe('límites de App Store Connect', () => {
  it.each([
    { archivo: 'ios/subtitulo.txt', texto: subtitulo, limite: 30 },
    { archivo: 'ios/texto-promocional.txt', texto: promocional, limite: 170 },
    { archivo: 'ios/descripcion.txt', texto: descripcionIos, limite: 4000 },
    { archivo: 'ios/palabras-clave.txt', texto: palabrasClave, limite: 100 },
    { archivo: 'ios/notas-revision.txt', texto: notasRevision, limite: 4000 },
  ])('$archivo cabe en $limite caracteres', ({ texto, limite }) => {
    expect(texto.trim()).not.toBe('');
    expect(largo(texto)).toBeLessThanOrEqual(limite);
    expect(texto).toBe(texto.trim());
  });

  it('el subtítulo, el texto promocional y las palabras clave son de una línea', () => {
    for (const t of [subtitulo, promocional, palabrasClave]) expect(t).not.toMatch(/\n/);
  });

  it('las palabras clave van separadas por coma, sin espacios alrededor, sin repetirse ni gastar el nombre', () => {
    const lista = palabrasClave.split(',');
    for (const p of lista) {
      expect(p).toBe(p.trim());
      expect(p).not.toBe('');
    }
    expect(new Set(lista.map((p) => p.toLowerCase())).size).toBe(lista.length);
    // Apple ya indexa el nombre de la app y la categoría: repetirlos desperdicia caracteres.
    expect(palabrasClave).not.toMatch(/finanvoz|finanzas/i);
  });

  it('la ficha de iOS no menciona otras plataformas (directriz 2.3.10) ni lo que no va en iPhone', () => {
    for (const t of [subtitulo, promocional, descripcionIos, palabrasClave, notasRevision]) {
      expect(t).not.toMatch(/android|google play|play store|widget/i);
    }
  });

  it('las notas para la revisión van en inglés y dicen que no hay cuenta ni compras y cómo probar el dictado', () => {
    expect(notasRevision).toMatch(/NO ACCOUNT NEEDED/);
    expect(notasRevision).toMatch(/No in-app purchases/);
    expect(notasRevision).toMatch(/press and hold "Hablar"/);
    expect(notasRevision).toContain(RESPONSABLE.correo);
  });
});

describe('reglas del texto', () => {
  const todos = [titulo, corta, completa, notas, subtitulo, promocional, descripcionIos, palabrasClave];

  it('sin exclamaciones, emojis ni precios', () => {
    for (const t of [...todos, notasRevision]) {
      expect(t).not.toMatch(/[!¡]/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\$\s?\d|MXN|al mes por|\/mes/);
    }
  });

  it('sin términos promocionales que las tiendas no permiten en el título, la descripción breve, el subtítulo ni el texto promocional', () => {
    for (const t of [titulo, corta, subtitulo, promocional]) {
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

  it('la descripción de iOS lleva el texto fijo de Acerca de y el correo, y describe la build sin nube ni compras', () => {
    expect(descripcionIos).toContain(TEXTO_NO_ASESORIA);
    expect(descripcionIos).toContain(RESPONSABLE.correo);
    expect(descripcionIos).toMatch(/No necesitas cuenta ni iniciar sesión/);
    expect(descripcionIos).toMatch(/movimientos se guardan cifrados en tu iPhone/);
    expect(descripcionIos).toMatch(/No se envía a nuestros servidores/);
    expect(descripcionIos).toMatch(/reporte de error no lleva montos/);
    expect(descripcionIos).toMatch(/estadísticas de uso son opcionales/);
    // La build de tienda de iOS no tiene nube ni compras (`IOS-APP-STORE.md` §0): cuando se activen, cambian el
    // texto, la etiqueta de privacidad y esta prueba en el mismo commit.
    expect(descripcionIos).not.toMatch(/\bPlus\b|inteligencia artificial|prueba gratis|suscr[ií]bete/i);
  });

  it('usa la marca Finanvoz, no el nombre de trabajo "Cartera"', () => {
    expect(titulo.startsWith('Finanvoz')).toBe(true);
    for (const t of todos) expect(t).not.toMatch(/\bCartera\b/);
  });
});
