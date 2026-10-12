import { partes, type PlainDate } from '../fecha';

/** Versión del simulador: entra en la semilla diaria y en `prediccion.version_simulador`. */
export const VERSION_SIMULADOR = 'v1';

/**
 * E8.1 · Mulberry32, bit a bit idéntico al de `docs/05-MOTORES.md` (vector `E8.mulberry32`). El simulador usa
 * una copia en línea de este mismo paso (`simulacion.ts`) por rendimiento; una prueba compara ambos.
 */
export function mulberry32(semilla: number): () => number {
  let a = semilla | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bytes UTF-8 de `texto` sin depender de `TextEncoder`; un sustituto suelto se codifica como U+FFFD. */
function utf8(texto: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    let cp = texto.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < texto.length) {
      const bajo = texto.charCodeAt(i + 1);
      if (bajo >= 0xdc00 && bajo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (bajo - 0xdc00);
        i++;
      }
    }
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return bytes;
}

/** E8.1 · FNV-1a de 32 bits sobre los bytes UTF-8 (base `0x811c9dc5`, primo `0x01000193`). */
export function fnv1a32(texto: string): number {
  let h = 0x811c9dc5;
  for (const b of utf8(texto)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
}

/** Semilla de producción: `fnv1a32("<hoy>|v1")`. No cambia en todo el día (CA-M6-06). */
export function semillaDelDia(hoy: PlainDate): number {
  partes(hoy);
  return fnv1a32(`${hoy}|${VERSION_SIMULADOR}`);
}
