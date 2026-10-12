/**
 * UUIDv7 (RFC 9562): 48 bits de milisegundos + versión + 74 bits aleatorios. Ordenable por tiempo (`04 §1`).
 * `ahora` y `aleatorio` se inyectan (expo-crypto en la app, node:crypto en Node).
 */
export function crearGeneradorUuidV7(
  ahora: () => number,
  aleatorio: (n: number) => Uint8Array,
): () => string {
  return () => {
    const bytes = aleatorio(16);
    let ms = Math.max(0, Math.floor(ahora()));
    for (let i = 5; i >= 0; i--) {
      bytes[i] = ms % 256;
      ms = Math.floor(ms / 256);
    }
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

/** Generador determinista para pruebas: `p-000001`, `p-000002`… */
export function crearGeneradorSecuencial(prefijo = 'id'): () => string {
  let n = 0;
  return () => `${prefijo}-${String(++n).padStart(6, '0')}`;
}
