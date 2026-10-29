/**
 * Producciones del nivel 0 que antes iban a la nube solo para que la nube preguntara o dijera que no (docs/06-NLU.md
 * §9.2, regla de costo del 23-10-2026). No registran nada: fuera de alcance claro, la pregunta abierta «¿por qué…?»
 * (modo explicar) y las aclaraciones obvias (gasto sin cifra, sueldo bruto, «la semana pasada» sin día, «¿me
 * alcanza?» sin precio). Responden lo mismo que el nivel 2 en el golden set; si dudan, `null` (la nube decide).
 */
import type { Interpretacion } from '../esquema';
import { SEP, type Tokens } from './tokens';

/** Palabras que ya son una cifra (o parte de una): con alguna, la frase no es «sin monto». */
const PALABRAS_NUMERO = new Set([
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
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
  'cien',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
  'mil',
  'millon',
  'millones',
  'luca',
  'lucas',
  'kilo',
  'kilos',
  'varo',
  'varos',
  'baro',
  'baros',
  'medio',
  'media',
  'pesos',
  'peso',
  'pesitos',
  'cero',
  'nada',
]);

export const tieneCifra = (t: readonly string[]) =>
  t.some((p) => /\d/.test(p) || PALABRAS_NUMERO.has(p) || /^veinti/.test(p));

const contiene = (t: readonly string[], ...secuencia: readonly string[]) =>
  t.some((_, i) => secuencia.every((p, k) => t[i + k] === p));

const DIAS = new Set(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
const PERIODO = new Set(['quincena', 'mes', 'semana', 'fin', 'llegar', 'llego', 'hoy', 'dia', 'pago']);

/** Inicios de un gasto dicho como hecho («compré…», «me eché…»), con «ya», «hoy» o «ayer» delante. */
const VERBOS_GASTO: readonly (readonly string[])[] = [
  ['me', 'compre'],
  ['me', 'eche'],
  ['me', 'tome'],
  ['compre'],
  ['gaste'],
  ['pague'],
  ['coopere'],
];
const PREVIOS = new Set(['ya', 'hoy', 'ayer', 'anoche', 'tambien']);

function empiezaConGasto(t: readonly string[]): boolean {
  let i = 0;
  // «la semana pasada me compré unos tenis de 1,200»: la fecha va antes del verbo (se pregunta qué día).
  if (t[0] === 'la' && t[1] === 'semana' && t[2] === 'pasada') i = 3;
  while (i < t.length && PREVIOS.has(t[i] ?? '')) i++;
  return VERBOS_GASTO.some((v) => v.every((p, k) => t[i + k] === p));
}

/** Primera cifra de un monto dicho como "dos cincuenta" ($2.50 o $250): de 2 a 29. */
const PRIMERA_AMBIGUA: Readonly<Record<string, number>> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
/** Segunda cifra: de 10 a 99 en palabras ("cincuenta", "treinta y cinco", "quince"). */
const DECENAS_AMBIGUAS: Readonly<Record<string, number>> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};
const UNIDADES_SUELTAS: Readonly<Record<string, number>> = {
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};
/** Inicios con el costo: "me salió en dos cincuenta el estacionamiento". */
const VERBOS_COSTO: readonly (readonly string[])[] = [['me', 'salio'], ['me', 'costo'], ['salio'], ['costo']];

/** "$250", "$1,250" (n < 1,000,000); sin `Intl` para que el teléfono y Node den lo mismo. */
const pesos = (n: number) =>
  n < 1000 ? `$${n}` : `$${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`;
const MONEDA = new Set(['pesos', 'peso', 'pesitos', 'varos', 'varo', 'baros', 'baro']);

/**
 * "dos cincuenta", "doce cincuenta", "tres treinta y cinco": dos cifras pegadas que el nivel 0 no lee (`montos.ts`)
 * porque pueden ser centavos o cientos. Con la frase de un gasto y ninguna otra cifra, se pregunta cuál fue (M11),
 * igual que la nube (06 §3.1 Montos). Nunca tras "a las" o "las" (es una hora).
 */
function montoAmbiguo(t: readonly string[]): Interpretacion | null {
  const u = ubicarMontoAmbiguo(t);
  if (!u) return null;
  return {
    intencion: 'aclarar',
    motivo: 'monto_ambiguo',
    pregunta: `¿Fueron ${pesosConCentavos(u.centavos)} o ${pesos(u.cientos / 100)}?`,
    opciones: [pesosConCentavos(u.centavos), pesos(u.cientos / 100)],
  };
}

const pesosConCentavos = (c: number) => `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

/**
 * Dónde está un "dos cincuenta" en `t` (sin separadores) y sus dos lecturas en centavos: $2.50 (250) o $250
 * (25000). Lo usa también la respuesta a esa aclaración (`seguimiento.ts`) para cambiar la pareja por la cifra
 * elegida. `null` si no hay una pareja así o si la frase trae otra cifra.
 */
export function ubicarMontoAmbiguo(
  t: readonly string[],
): { inicio: number; fin: number; centavos: number; cientos: number } | null {
  for (let i = 0; i < t.length - 1; i++) {
    const primera = PRIMERA_AMBIGUA[t[i] ?? ''];
    if (primera === undefined || t[i - 1] === 'las') continue;
    const siguiente = t[i + 1] ?? '';
    let segunda = DECENAS_AMBIGUAS[siguiente] ?? PRIMERA_AMBIGUA[siguiente] ?? 0;
    if (segunda < 10) continue;
    let fin = i + 2;
    const unidad = UNIDADES_SUELTAS[t[i + 3] ?? ''];
    if (DECENAS_AMBIGUAS[siguiente] !== undefined && t[i + 2] === 'y' && unidad !== undefined) {
      segunda += unidad;
      fin = i + 4;
    }
    if (tieneCifra([...t.slice(0, i), ...t.slice(fin)].filter((p) => !MONEDA.has(p)))) return null;
    return { inicio: i, fin, centavos: primera * 100 + segunda, cientos: (primera * 100 + segunda) * 100 };
  }
  return null;
}

const empiezaConCosto = (t: readonly string[]) =>
  empiezaConGasto(t) || VERBOS_COSTO.some((v) => v.every((p, k) => t[k] === p));

/** Imperativos de mover dinero: la app solo lleva la cuenta (`08 §1`). */
const MOVER_DINERO = new Set([
  'transfiere',
  'transfierele',
  'transfiereles',
  'transfiereme',
  'deposita',
  'depositale',
  'depositame',
  'mandale',
  'mandame',
  'enviale',
  'enviame',
  'pagale',
  'paga',
]);
const RELLENO_INICIO = new Set(['oye', 'porfa', 'porfavor', 'favor', 'por']);
const INVERSION = new Set([
  'invertir',
  'inversion',
  'inversiones',
  'acciones',
  'cripto',
  'criptos',
  'criptomonedas',
  'bitcoin',
]);
const CONSEJO = new Set(['conviene', 'recomiendas', 'recomiendes', 'recomiendan', 'deberia', 'mejor']);

/** fuera_de_alcance claro (F01–F04 del golden set); cualquier otra cosa sigue su camino. */
export function fueraDeAlcance(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length === 0) return null;
  if (
    t.includes('prompt') ||
    ((t.includes('ignora') || t.includes('olvida') || t.includes('olvidate')) &&
      (t.includes('instrucciones') || t.includes('reglas'))) ||
    (t.includes('instrucciones') && (t.includes('dime') || t.includes('muestrame') || t.includes('ensename')))
  ) {
    return { intencion: 'fuera_de_alcance', motivo: 'instrucciones' };
  }
  let i = 0;
  while (i < t.length - 1 && RELLENO_INICIO.has(t[i] ?? '')) i++;
  if (
    MOVER_DINERO.has(t[i] ?? '') ||
    contiene(t, 'haz', 'una', 'transferencia') ||
    contiene(t, 'hazme', 'una', 'transferencia')
  ) {
    return { intencion: 'fuera_de_alcance', motivo: 'mueve_dinero' };
  }
  if (t.some((p) => INVERSION.has(p)) && t.some((p) => CONSEJO.has(p))) {
    return { intencion: 'fuera_de_alcance', motivo: 'asesoria_inversion' };
  }
  if (t.includes('chiste') || t.includes('chistes'))
    return { intencion: 'fuera_de_alcance', motivo: 'ajeno' };
  return null;
}

/** «¿Por qué…?» es una pregunta abierta sobre su dinero: el modo explicar (Plus) la contesta con sus herramientas. */
export function preguntaPorQue(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length < 4 || t[0] !== 'por' || t[1] !== 'que') return null;
  const pregunta = tokens.o
    .filter((p) => p !== SEP)
    .join(' ')
    .trim();
  return { intencion: 'consultar', consulta: { tipo: 'explicar', pregunta } };
}

/**
 * Aclaraciones que no necesitan a la nube. Van al final del nivel 0: solo si ninguna producción entendió la frase.
 * - un gasto dicho como hecho sin ninguna cifra («me compré una coca», «pagué la tarjeta») → monto_faltante;
 * - «la semana pasada» sin día al registrar → fecha_ambigua;
 * - un sueldo «bruto» → monto_ambiguo (se pregunta cuánto le llega);
 * - «¿me alcanza?» o «¿me alcanza para…?» sin precio → monto_faltante;
 * - un gasto con un monto como «dos cincuenta» ($2.50 o $250) → monto_ambiguo con las dos opciones (26-10-2026).
 */
export function aclaracionLocal(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length === 0 || t[0] === 'no') return null;
  const cifra = tieneCifra(t);
  if ((t.includes('brutos') || t.includes('bruto')) && cifra) {
    return {
      intencion: 'aclarar',
      motivo: 'monto_ambiguo',
      pregunta: '¿Cuánto te llega ya con descuentos?',
    };
  }
  // «¿me alcanza para llegar a la quincena?» no es una compra: esa la decide la nube (o una consulta).
  const hablaDelPeriodo = t.some((p) => PERIODO.has(p));
  if (t[0] === 'me' && (t[1] === 'alcanza' || t[1] === 'alcanzaria') && !cifra && !hablaDelPeriodo) {
    return {
      intencion: 'aclarar',
      motivo: 'monto_faltante',
      pregunta: '¿Cuánto cuesta lo que quieres comprar?',
    };
  }
  if (empiezaConCosto(t)) {
    const ambiguo = montoAmbiguo(t);
    if (ambiguo) return ambiguo;
  }
  if (!empiezaConGasto(t)) return null;
  if (!cifra) return { intencion: 'aclarar', motivo: 'monto_faltante', pregunta: '¿Cuánto fue?' };
  if (contiene(t, 'semana', 'pasada') && !t.some((p) => DIAS.has(p))) {
    return { intencion: 'aclarar', motivo: 'fecha_ambigua', pregunta: '¿Qué día de la semana pasada fue?' };
  }
  return null;
}
