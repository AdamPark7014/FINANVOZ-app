import type { Centavos } from '@cartera/core';

/**
 * Formato de cifras para la UI (02-UX §14). Solo presentación: recibe centavos ya calculados
 * por `servicios/` y nunca hace aritmética de negocio.
 */

/**
 * - `auto`: `$1,500` sin centavos si son .00; `$1,099.90` con centavos.
 * - `centavos`: siempre con dos decimales (`$1,500.00`), para formularios y detalle.
 * - `pesos`: pesos enteros redondeados hacia abajo (`$214`), para "Hoy puedes".
 */
export type ModoCifra = 'auto' | 'centavos' | 'pesos';

const SIGNO_MENOS = '−';

function agruparMiles(entero: number): string {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `150000` → `$1,500`; `-37400` → `−$374`; con `modo: 'centavos'` → `$1,500.00`. */
export function formatearCentavos(c: Centavos, modo: ModoCifra = 'auto'): string {
  if (!Number.isSafeInteger(c)) return '—';
  const negativo = c < 0;
  const abs = Math.abs(c);
  let pesos = Math.floor(abs / 100);
  const resto = abs % 100;
  let decimales = '';
  if (modo === 'centavos') {
    decimales = `.${String(resto).padStart(2, '0')}`;
  } else if (modo === 'auto' && resto !== 0) {
    decimales = `.${String(resto).padStart(2, '0')}`;
  } else if (modo === 'pesos' && negativo && resto !== 0) {
    // Hacia abajo también para negativos: −$3.50 se muestra como −$4 (no infla lo que tienes).
    pesos += 1;
  }
  const signo = negativo && (pesos > 0 || decimales !== '') ? SIGNO_MENOS : '';
  return `${signo}$${agruparMiles(pesos)}${decimales}`;
}

/**
 * Convierte lo que escribe la persona ("20,000", "$1,099.9", "1500", ".5") a centavos
 * sin pasar por flotantes. Devuelve `null` si no es un monto válido; vacío es `null`.
 */
export function leerPesos(texto: string): Centavos | null {
  const limpio = texto.replace(/[\s$]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const m = /^(\d{0,12})(?:\.(\d{0,2}))?$/.exec(limpio);
  if (!m) return null;
  const pesos = m[1] ?? '';
  const fraccion = m[2] ?? '';
  if (pesos === '' && fraccion === '') return null;
  return Number(pesos || '0') * 100 + Number(fraccion.padEnd(2, '0'));
}

const UNIDADES = [
  '',
  'uno',
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
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function menorQueMil(n: number): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c] ?? '');
  if (r > 0 && r < 30) partes.push(UNIDADES[r] ?? '');
  else if (r >= 30) {
    const d = Math.floor(r / 10);
    const u = r % 10;
    partes.push(u === 0 ? (DECENAS[d] ?? '') : `${DECENAS[d] ?? ''} y ${UNIDADES[u] ?? ''}`);
  }
  return partes.join(' ');
}

/** "uno" se apocopa ante sustantivo masculino: "veintiún pesos", "un millón". */
function apocopar(texto: string): string {
  return texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
}

/** Número entero no negativo en palabras (es-MX), para etiquetas de TalkBack. */
export function enteroEnPalabras(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return String(n);
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${apocopar(enteroEnPalabras(millones))} millones`);
  }
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${apocopar(menorQueMil(miles))} mil`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(' ');
}

/**
 * Etiqueta hablada de una cifra (02-UX §15): `21400` → "doscientos catorce pesos";
 * `109990` → "mil noventa y nueve pesos con noventa centavos"; negativos con "menos".
 * Respeta el mismo `modo` que el texto visible.
 */
export function cifraEnPalabras(c: Centavos, modo: ModoCifra = 'auto'): string {
  if (!Number.isSafeInteger(c)) return 'cifra no disponible';
  const negativo = c < 0;
  const abs = Math.abs(c);
  let pesos = Math.floor(abs / 100);
  let resto = abs % 100;
  if (modo === 'pesos') {
    if (negativo && resto !== 0) pesos += 1;
    resto = 0;
  }
  const textoPesos =
    pesos === 1
      ? 'un peso'
      : `${apocopar(enteroEnPalabras(pesos))}${pesos % 1_000_000 === 0 && pesos > 0 ? ' de' : ''} pesos`;
  const textoCentavos =
    resto === 0 ? '' : ` con ${resto === 1 ? 'un centavo' : `${apocopar(enteroEnPalabras(resto))} centavos`}`;
  const signo = negativo && (pesos > 0 || resto > 0) ? 'menos ' : '';
  return `${signo}${textoPesos}${textoCentavos}`;
}

/** Una cifra con el formato de `formatearCentavos` dentro de un texto: `$1,099.90`, `−$374`, `$0.05`. */
const CIFRA_EN_TEXTO = /([−-])?\$(\d{1,3}(?:,\d{3})*)(?:\.(\d{2}))?/g;

/** ¿El texto trae alguna cifra de dinero con formato de la UI (`$` seguido de dígitos)? */
export function tieneCifra(texto: string): boolean {
  return /\$\d/.test(texto);
}

/**
 * Etiqueta de TalkBack de un texto con cifras (02-UX §15): cada `$1,500` del texto se lee en palabras
 * ("mil quinientos pesos"), igual que en `Cifra`; el resto queda igual. Solo presentación.
 */
export function etiquetaHablada(texto: string): string {
  return texto.replace(CIFRA_EN_TEXTO, (_, signo: string | undefined, pesos: string, cent?: string) => {
    const centavos = Number(pesos.replace(/,/g, '')) * 100 + Number(cent ?? '0');
    return cifraEnPalabras(signo ? -centavos : centavos);
  });
}

/** Campo editable de pesos (02-UX §15): nombre + monto escrito en palabras, sin leer dígitos sueltos. */
export function etiquetaCampoMonto(etiqueta: string, texto: string): string {
  const nombre = `${etiquetaHablada(etiqueta)} en pesos`;
  const centavos = leerPesos(texto);
  return centavos === null ? nombre : `${nombre}, ${cifraEnPalabras(centavos, 'centavos')}`;
}
