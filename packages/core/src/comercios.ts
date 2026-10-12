/** E9.1 y E9.2 · Normalización de comercios y similitud (`docs/05-MOTORES.md §E9`). */

/** Palabras vacías de E9.1, paso 4. */
const PALABRAS_VACIAS: ReadonlySet<string> = new Set([
  'SA',
  'DE',
  'CV',
  'SAPI',
  'SAB',
  'S',
  'A',
  'C',
  'V',
  'RL',
  'MX',
  'MEX',
  'SUC',
  'SUCURSAL',
  'TDA',
  'TIENDA',
  'POS',
  'COMPRA',
  'PAGO',
  'EN',
]);

const MARCAS_DIACRITICAS = /\p{Mn}/gu;
const FUERA_DE_ALFABETO = /[^A-Z0-9]/g;
const SOLO_DIGITOS = /^[0-9]+$/;

/** E9.1 · `null`/vacío → `''`; sin acentos, mayúsculas, solo `A–Z0–9`, sin números sueltos ni palabras vacías. */
export function normalizarComercio(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(MARCAS_DIACRITICAS, '')
    .toUpperCase()
    .replace(FUERA_DE_ALFABETO, ' ')
    .split(' ')
    .filter((t) => t !== '' && !SOLO_DIGITOS.test(t) && !PALABRAS_VACIAS.has(t))
    .join(' ');
}

/** E9.2 · Similitud de Jaro; `t` sin redondear. Dos cadenas vacías dan 0. */
export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return s1 ? 1 : 0;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;
  const ventana = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const m1 = new Array<boolean>(l1).fill(false);
  const m2 = new Array<boolean>(l2).fill(false);
  let m = 0;
  for (let i = 0; i < l1; i++) {
    const hasta = Math.min(i + ventana + 1, l2);
    for (let j = Math.max(0, i - ventana); j < hasta; j++) {
      if (!m2[j] && s1[i] === s2[j]) {
        m1[i] = true;
        m2[j] = true;
        m++;
        break;
      }
    }
  }
  if (m === 0) return 0;
  let fuera = 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) fuera++;
    k++;
  }
  const t = fuera / 2;
  return (m / l1 + m / l2 + (m - t) / m) / 3;
}

/** E9.2 · Jaro–Winkler: si `jaro > 0.7`, `jaro + l·0.1·(1 − jaro)` con `l` = prefijo común ≤ 4. */
export function jaroWinkler(s1: string, s2: string): number {
  const j = jaro(s1, s2);
  if (j <= 0.7) return j;
  let prefijo = 0;
  const limite = Math.min(4, s1.length, s2.length);
  while (prefijo < limite && s1[prefijo] === s2[prefijo]) prefijo++;
  return j + prefijo * 0.1 * (1 - j);
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter((t) => t !== '');
}

/**
 * E9.2 · `a` y `b` ya normalizados (E9.1). 0 si alguno está vacío; 1 si los tokens del más corto
 * están contenidos en los del más largo; si no, Jaro–Winkler.
 */
export function similitud(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = tokens(a);
  const tb = tokens(b);
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const enLargo = new Set(largo);
  if (corto.every((t) => enLargo.has(t))) return 1;
  return jaroWinkler(a, b);
}
