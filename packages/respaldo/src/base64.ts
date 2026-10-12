const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALOR = new Map<string, number>([...ALFABETO].map((c, i) => [c, i]));

/** Base64 estándar con relleno (sin depender de `Buffer` ni de `btoa`, que no existen igual en Hermes). */
export function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += ALFABETO[(n >> 18) & 63];
    s += ALFABETO[(n >> 12) & 63];
    s += b === undefined ? '=' : ALFABETO[(n >> 6) & 63];
    s += c === undefined ? '=' : ALFABETO[n & 63];
  }
  return s;
}

/** Decodifica base64 estándar estricto; `null` si el texto no es base64 canónico. */
export function deBase64(texto: string): Uint8Array | null {
  if (texto.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(texto)) return null;
  const relleno = texto.endsWith('==') ? 2 : texto.endsWith('=') ? 1 : 0;
  const salida = new Uint8Array((texto.length / 4) * 3 - relleno);
  let j = 0;
  for (let i = 0; i < texto.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => VALOR.get(texto[i + k] ?? '=') ?? 0);
    const n = ((v[0] ?? 0) << 18) | ((v[1] ?? 0) << 12) | ((v[2] ?? 0) << 6) | (v[3] ?? 0);
    for (const desplazamiento of [16, 8, 0]) {
      if (j < salida.length) salida[j++] = (n >> desplazamiento) & 255;
    }
  }
  return aBase64(salida) === texto ? salida : null;
}
