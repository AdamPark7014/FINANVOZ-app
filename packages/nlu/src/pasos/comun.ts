/**
 * Piezas comunes de los lectores por paso (docs/06-NLU.md §13): cifras con su marca de aproximado, la partición
 * de una frase en tramos ("y" o coma) y la regla de "una sola lectura posible".
 */
import { Lector } from '../reglas/lector';
import { leerMonto, type LecturaMonto } from '../reglas/montos';
import { SEP, recortar, type Tokens } from '../reglas/tokens';
import type { Cifra } from './esquema';

export const cifraDe = (m: LecturaMonto): Cifra => ({ monto: m.monto, aproximado: m.aproximado });

/**
 * MONTO0 en el cursor: un monto (con "como", "N mil M", "pesos con N centavos"…) o "cero [pesos]". Sin
 * `admiteCero`, $0 no vale. `null` sin mover el cursor.
 */
export function leerCifra(l: Lector, admiteCero: boolean): Cifra | null {
  const inicio = l.marca();
  if (admiteCero && l.alguna(['cero', 'pesos'], ['cero'])) return { monto: 0, aproximado: false };
  const m = leerMonto(l);
  if (!m) return null;
  if (m.monto === 0 && !admiteCero) {
    l.volver(inicio);
    return null;
  }
  return cifraDe(m);
}

/**
 * ¿Algún monto de la frase lleva marca de aproximado? Las producciones de `configurar` no guardan "como" (el
 * esquema del ajuste no lo tiene); el lector del paso sí lo devuelve.
 */
export function hayAproximado(tokens: Tokens): boolean {
  const l = new Lector(tokens);
  for (let i = 0; i < tokens.t.length; i++) {
    l.volver(i);
    if (leerMonto(l)?.aproximado) return true;
  }
  return false;
}

/** Una sola lectura posible entre las candidatas (iguales cuentan como una); si no, `null`. */
export function unica<T>(candidatas: readonly T[]): T | null {
  const distintas = new Map(candidatas.map((c) => [JSON.stringify(c), c]));
  if (distintas.size !== 1) return null;
  const [una] = distintas.values();
  return una ?? null;
}

const TOPE_INTENTOS = 4000;
const TOPE_SOLUCIONES = 64;

/**
 * Parte la frase en tramos separados por "y", coma o ", y" y prueba **todas** las particiones: cada tramo debe
 * leerse completo con `leerTramo` y caben a lo más `max` tramos. Así un "y" dentro de una cifra ("ochenta y cinco")
 * o de un dato ("tengo una compra a meses de 500 y me faltan 6") no corta la frase por error. Devuelve los tramos
 * de la única lectura posible; si no hay ninguna o hay varias distintas, `null`.
 */
export function partir<T>(tokens: Tokens, leerTramo: (tramo: Tokens) => T | null, max: number): T[] | null {
  const n = tokens.t.length;
  const memo = new Map<string, T | null>();
  const soluciones: T[][] = [];
  let intentos = 0;
  let desbordado = false;

  const tramo = (i: number, j: number): T | null => {
    const clave = `${i}:${j}`;
    if (!memo.has(clave)) {
      intentos++;
      memo.set(clave, leerTramo(recortar(tokens, i, j)));
    }
    return memo.get(clave) ?? null;
  };
  const esSeparador = (p: string | undefined) => p === 'y' || p === SEP;

  const recorrer = (inicio: number, acumulado: readonly T[]) => {
    if (desbordado || acumulado.length >= max) return;
    for (let fin = inicio + 1; fin <= n; fin++) {
      if (fin < n && !esSeparador(tokens.t[fin])) continue;
      if (intentos > TOPE_INTENTOS || soluciones.length > TOPE_SOLUCIONES) {
        desbordado = true;
        return;
      }
      const r = tramo(inicio, fin);
      if (r === null) continue;
      const siguiente = [...acumulado, r];
      if (fin === n) {
        soluciones.push(siguiente);
        continue;
      }
      let despues = fin + 1;
      if (tokens.t[fin] === SEP && tokens.t[despues] === 'y') despues++;
      if (despues < n) recorrer(despues, siguiente);
    }
  };
  recorrer(0, []);
  return desbordado ? null : unica(soluciones);
}

/** "oro" → "Oro"; "la azul" → "La azul" (nombre de una tarjeta o cuenta fuera del catálogo, tal como se dijo). */
export function mayusculaInicial(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
