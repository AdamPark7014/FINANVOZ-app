/**
 * Validación de cifras del modo explicar (`06 §6`, regla 4): toda cifra de la respuesta del modelo debe aparecer en
 * algún resultado de herramienta. Si no, el teléfono muestra la respuesta en plantilla. Es deliberadamente
 * estricta: una cifra copiada con otro formato equivalente pasa ("$1850" = "$1,850" = "1,850.00"), pero una suma,
 * resta, redondeo o porcentaje que no esté en los resultados no pasa, y tampoco las cantidades escritas con
 * letras ("doce", "mil", "la mitad"), que no se pueden comparar.
 */

/** "1,850", "1,099.90", "214", "3.5" (no toma el punto final de una oración). */
const CIFRA = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/** Cantidades con letras (y proporciones) que esconderían una cifra o un cálculo. "un/una/uno" se permiten. */
const EN_LETRAS = new RegExp(
  `(?<![\\p{L}])(${[
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'diecis[eé]is',
    'dieci\\p{L}+',
    'veinte',
    'veinti\\p{L}+',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa',
    'cien',
    'ciento',
    '\\p{L}+cientos',
    '\\p{L}+cientas',
    'mil',
    'miles',
    'mill[oó]n',
    'millones',
    'mitad',
    'doble',
    'triple',
    'tercio',
    'cuarto',
    'por ciento',
  ].join('|')})(?![\\p{L}])`,
  'iu',
);

/** Forma canónica: sin comas ni ceros sobrantes ("1,850.00" → "1850"; "1,099.90" → "1099.9"; "05" → "5"). */
function normalizar(cifra: string): string {
  const [entero = '', decimales = ''] = cifra.replace(/,/g, '').split('.');
  const e = entero.replace(/^0+(?=\d)/, '');
  const d = decimales.replace(/0+$/, '');
  return d === '' ? e : `${e}.${d}`;
}

/** Cifras de un texto en forma canónica, en orden de aparición. */
export function extraerCifras(texto: string): string[] {
  return (texto.match(CIFRA) ?? []).map(normalizar);
}

export type ValidacionCifras =
  | { readonly ok: true; readonly cifras: readonly string[] }
  | { readonly ok: false; readonly motivo: 'vacia' | 'cifra_ajena' | 'cifra_en_letras' };

/**
 * `ok` si la respuesta no está vacía, no trae cantidades con letras y cada cifra aparece en algún resultado.
 * Nunca devuelve las cifras que fallaron: nada de esto se registra (regla 9).
 */
export function validarCifras(respuesta: string, resultados: readonly string[]): ValidacionCifras {
  if (respuesta.trim() === '') return { ok: false, motivo: 'vacia' };
  if (EN_LETRAS.test(respuesta)) return { ok: false, motivo: 'cifra_en_letras' };
  const permitidas = new Set(resultados.flatMap(extraerCifras));
  const cifras = extraerCifras(respuesta);
  if (!cifras.every((c) => permitidas.has(c))) return { ok: false, motivo: 'cifra_ajena' };
  return { ok: true, cifras };
}
