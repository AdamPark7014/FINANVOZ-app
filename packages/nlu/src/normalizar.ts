const PALABRAS_ALIAS = new Set([
  'la',
  'el',
  'los',
  'las',
  'mi',
  'mis',
  'de',
  'del',
  'con',
  'tarjeta',
  'cuenta',
]);

/** Minúsculas y sin marcas diacríticas (NFD). */
export function sinAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

/**
 * `normalizarAlias(s)` (docs/06-NLU.md §5): minúsculas, sin acentos, todo lo que no sea letra o número → espacio,
 * elimina `la el los las mi mis de del con tarjeta cuenta`, espacios simples.
 */
export function normalizarAlias(s: string): string {
  return sinAcentos(s)
    .replace(/[^\p{L}\p{N}]/gu, ' ')
    .split(' ')
    .filter((t) => t !== '' && !PALABRAS_ALIAS.has(t))
    .join(' ');
}
