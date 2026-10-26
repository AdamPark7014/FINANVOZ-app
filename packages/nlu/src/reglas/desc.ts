/**
 * DESC del nivel 0 (docs/06-NLU.md §9): 1 a 3 palabras sin enlace, categoría por diccionario; DESC compuesta
 * ("consulta con el médico"); DESC con comercio ("despensa en Soriana"); frases fijas del diccionario ("me cortaron
 * el pelo", "el agua"); y, con negocio activo, "mercancía" e "insumos".
 */
import type { Categoria } from '../esquema';
import { buscarEnDiccionario, MASCOTAS_DESTINO, sonConocidas } from './diccionario';
import type { Entorno } from './entorno';
import {
  ARTICULOS,
  PALABRAS_PROHIBIDAS_DESC,
  PALABRAS_QUE_DESCARTAN,
  SEP,
  type Tokens,
  palabraDesc,
} from './tokens';

export interface Desc {
  descripcion: string;
  categoria?: Categoria;
  espacio?: 'negocio';
}

export interface OpcionesDesc {
  /** DESC_CONOCIDA: todas las palabras deben estar en el diccionario. */
  conocida: boolean;
  /** La DESC viene después de "de MONTO" o lleva "el": "agua" es el recibo (servicios). */
  recibo?: boolean;
}

/** Unen dos partes de una DESC compuesta ("consulta con el médico", "medicinas de la farmacia"). */
const CONECTORES_DESC = new Set(['con', 'de', 'del', 'en', 'para', 'al']);
/**
 * Conectores de pertenencia o destino ("pastel de la oficina", "croquetas para el perro", "tacos al pastor"): basta
 * con que A sea conocida; B solo cambia la categoría si es una mascota o si trae otra palabra del diccionario.
 */
const CONECTORES_DESTINO = new Set(['de', 'del', 'para', 'al']);
/** Tras "de", "del" o "para" la B puede llevar posesivo: "regalo para mi sobrina". */
const POSESIVOS = new Set(['mi', 'mis', 'su', 'sus', 'tu', 'tus']);

/** Frases del diccionario de §3.1 que llevan artículo o preposición y por eso no entran palabra por palabra. */
const FRASES_CONOCIDAS: readonly (readonly [string, Categoria])[] = [
  ['corte de pelo', 'cuidado_personal'],
  ['corte de cabello', 'cuidado_personal'],
  ['me cortaron el pelo', 'cuidado_personal'],
  ['me corte el pelo', 'cuidado_personal'],
  ['me cortaron el cabello', 'cuidado_personal'],
  ['el agua', 'servicios'],
  ['recibo de agua', 'servicios'],
  ['recibo del agua', 'servicios'],
  ['recibo de luz', 'servicios'],
  ['recibo de la luz', 'servicios'],
];

const COLAS_NEGOCIO: readonly (readonly string[])[] = [
  ['para', 'la', 'tienda'],
  ['para', 'el', 'negocio'],
  ['de', 'la', 'tienda'],
  ['del', 'negocio'],
];

const terminaCon = (palabras: readonly string[], cola: readonly string[]) =>
  cola.length < palabras.length && cola.every((p, k) => palabras[palabras.length - cola.length + k] === p);

/**
 * COMERCIO := 1 o 2 palabras con mayúscula inicial en el texto crudo (nunca la primera de la frase) que no son
 * alias, nombre, palabra del diccionario ni de enlace. Dictado o escrito, un nombre propio en medio de la frase es
 * un comercio o un lugar; no cambia el tipo del movimiento.
 */
export function esComercio(tokens: Tokens, inicio: number, fin: number, env: Entorno): boolean {
  const n = fin - inicio;
  if (inicio < 1 || n < 1 || n > 2) return false;
  for (let i = inicio; i < fin; i++) {
    const crudo = tokens.c[i] ?? '';
    const p = tokens.t[i] ?? '';
    if (!/^\p{Lu}/u.test(crudo) || !/^[a-zñ]+$/.test(p)) return false;
    if (PALABRAS_PROHIBIDAS_DESC.has(p) || PALABRAS_QUE_DESCARTAN.has(p) || ARTICULOS.has(p)) return false;
    if (buscarEnDiccionario([p]).cubiertas.every(Boolean) || env.esAliasCuenta([p]) || env.nombres.has(p)) {
      return false;
    }
  }
  return (
    !env.esAliasCuenta(tokens.t.slice(inicio, fin)) && !env.esNombreConocido(tokens.t.slice(inicio, fin))
  );
}

function categoriaUnica(palabras: readonly string[], exigirTodas: boolean): Categoria | null {
  const { categorias, cubiertas } = buscarEnDiccionario(palabras);
  const [categoria] = categorias;
  if (exigirTodas && !cubiertas.every(Boolean)) return null;
  return categorias.size === 1 && categoria ? categoria : null;
}

/**
 * Categoría de "A de/para/al B" (06 §9.1, DESC compuesta de destino, 26-10-2026). Sin verbo, A debe ser conocida.
 * Una mascota en B gana ("comida para el perro" es de la mascota, no comida fuera); si no, la categoría es la única
 * del diccionario entre A y B ("regalo para mi sobrina" → regalos; "boletos del metro" → ninguna).
 */
function compraConDestino(
  antes: readonly string[],
  despues: readonly string[],
  conocida: boolean,
): { categoria?: Categoria } | null {
  if (conocida && !sonConocidas(antes)) return null;
  if (despues.some((p) => MASCOTAS_DESTINO.has(p))) return { categoria: 'mascotas' };
  const { categorias } = buscarEnDiccionario([...antes, ...despues]);
  const [unica] = categorias;
  return categorias.size === 1 && unica ? { categoria: unica } : {};
}

/** Palabras sueltas (sin conector): todas aptas y sin nombres ni alias. */
function palabrasSimples(palabras: readonly string[], env: Entorno): boolean {
  if (palabras.length < 1 || palabras.length > 3) return false;
  if (palabras.some((p) => !palabraDesc(p) || env.nombres.has(p))) return false;
  return !env.esNombreConocido(palabras) && !env.esAliasCuenta(palabras);
}

/**
 * Lee la DESC en `[inicio, fin)` de `tokens`. Devuelve `null` si no está segura (palabra de enlace o de las que
 * descartan, nombre, alias, más de tres palabras, dos categorías en una DESC_CONOCIDA).
 */
export function leerDesc(
  tokens: Tokens,
  inicio: number,
  fin: number,
  env: Entorno,
  opciones: OpcionesDesc,
): Desc | null {
  if (fin - inicio < 1) return null;
  let palabras = tokens.t.slice(inicio, fin);
  if (palabras.includes(SEP)) return null;
  const completa = tokens.o.slice(inicio, fin).join(' ');
  const frase = palabras.join(' ');
  const fija = FRASES_CONOCIDAS.find(([f]) => f === frase);
  if (fija) return { descripcion: completa, categoria: fija[1] };

  // Negocio: "mercancía [para la tienda]", "insumos del negocio".
  const colaNegocio = COLAS_NEGOCIO.find((c) => terminaCon(palabras, c));
  const sinCola = colaNegocio ? palabras.slice(0, palabras.length - colaNegocio.length) : palabras;
  const cuerpo = sinCola.length > 1 && ARTICULOS.has(sinCola[0] ?? '') ? sinCola.slice(1) : sinCola;
  if (cuerpo.length === 1 && cuerpo[0] !== undefined) {
    const categoriaNegocio = env.categoriaNegocio(cuerpo[0]);
    if (categoriaNegocio) return { descripcion: completa, categoria: categoriaNegocio, espacio: 'negocio' };
  }
  if (colaNegocio) return null;

  let desde = inicio;
  if (palabras.length > 1 && ARTICULOS.has(palabras[0] ?? '')) {
    desde++;
    palabras = palabras.slice(1);
  }
  // La descripción va sin el artículo inicial ("unos tenis" → "tenis").
  const descripcion = tokens.o.slice(desde, fin).join(' ');
  if (opciones.recibo && palabras.length === 1 && palabras[0] === 'agua') {
    return { descripcion, categoria: 'servicios' };
  }
  const conector = palabras.findIndex((p) => CONECTORES_DESC.has(p));
  if (conector !== -1) {
    const union = palabras[conector] ?? '';
    const antes = palabras.slice(0, conector);
    const despuesCrudo = palabras.slice(conector + 1);
    const primera = despuesCrudo[0] ?? '';
    const conArticulo =
      despuesCrudo.length > 1 &&
      (ARTICULOS.has(primera) || (CONECTORES_DESTINO.has(union) && POSESIVOS.has(primera)));
    const despues = conArticulo ? despuesCrudo.slice(1) : despuesCrudo;
    if (antes.length < 1 || despues.length < 1 || antes.length + despues.length > 3) return null;
    if (!palabrasSimples(antes, env)) return null;
    // "A con B" con todo del diccionario y una sola categoría.
    if (palabrasSimples(despues, env)) {
      const categoria = categoriaUnica([...antes, ...despues], true);
      if (categoria) return { descripcion, categoria };
      // "A de/para/al B": A conocida (o con verbo, cualquiera); B nunca es un nombre ni un alias.
      if (CONECTORES_DESTINO.has(union)) {
        const destino = compraConDestino(antes, despues, opciones.conocida);
        if (destino) return { descripcion, ...destino };
      }
    }
    // "A en COMERCIO": A conocida y B un comercio con mayúscula.
    const inicioComercio = desde + conector + 1 + (conArticulo ? 1 : 0);
    if (palabras[conector] === 'en' && esComercio(tokens, inicioComercio, fin, env)) {
      const categoria = categoriaUnica(antes, true);
      if (categoria) return { descripcion, categoria };
    }
    return null;
  }
  if (!palabrasSimples(palabras, env)) return null;
  const categoria = categoriaUnica(palabras, opciones.conocida);
  if (opciones.conocida && !categoria) {
    // Todas conocidas pero de dos categorías ("tacos coca") o sin categoría ("unas chelas") sigue siendo
    // DESC_CONOCIDA, sin categoría.
    return sonConocidas(palabras) ? { descripcion } : null;
  }
  return categoria ? { descripcion, categoria } : { descripcion };
}
