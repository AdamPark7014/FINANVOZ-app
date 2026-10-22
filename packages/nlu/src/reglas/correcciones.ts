/**
 * CORREGIR, ANULAR y REVISAR_DUPLICADOS del nivel 0 (docs/06-NLU.md §9). La referencia es la descripción dicha
 * (1 a 3 palabras del movimiento ya registrado) o "el último".
 */
import type { Centavos } from '@cartera/core';
import type { Categoria, Interpretacion, RefCuenta } from '../esquema';
import { leerCategoria } from './categorias';
import { esComercio } from './desc';
import type { Entorno } from './entorno';
import { leerFechaRegistro } from './fechas';
import { Lector } from './lector';
import { leerEntero, leerMonto } from './montos';
import { ARTICULOS, type Tokens, palabraDesc } from './tokens';

type Referencia = Extract<Interpretacion, { intencion: 'corregir' }>['objetivo'];
type Cambios = Extract<Interpretacion, { intencion: 'corregir' }>['cambios'];

const FUE = ['fue', 'fueron', 'era', 'eran', 'es', 'son'];
const BORRAR = ['borra', 'elimina', 'quita', 'cancela', 'deshaz', 'anula'];
const ANOTE = ['anote', 'registre', 'apunte', 'capture', 'meti'];
const ULTIMO: readonly (readonly string[])[] = [
  ['el', 'ultimo', 'movimiento'],
  ['el', 'ultimo', 'registro'],
  ['el', 'ultimo', 'gasto'],
  ['el', 'ultimo'],
  ['lo', 'ultimo'],
  ['la', 'ultima'],
];

const corregir = (objetivo: Referencia, cambios: Cambios): Interpretacion => ({
  intencion: 'corregir',
  objetivo,
  cambios,
});

/** Donde termina una DESC_REF: el verbo que sigue ("fue", "era", "está", "lo pagué"). */
const ALTO_REFERENCIA = new Set([...FUE, 'esta', 'salio', 'aparece', 'lo', 'la', 'los', 'las']);
/** Pronombres y genéricos que no identifican un movimiento ("borra todo", "quita eso"). */
const NO_SON_REFERENCIA = new Set([
  'todo',
  'todos',
  'toda',
  'todas',
  'eso',
  'esto',
  'ese',
  'esa',
  'este',
  'aquello',
  'algo',
  'nada',
  'ultimo',
  'ultima',
  'movimiento',
  'registro',
]);

/** DESC_REF := [art] 1 a 3 palabras aptas (sin nombres, alias ni enlaces); consume lo leído. */
function referencia(l: Lector, env: Entorno, max = 3): string | null {
  const inicio = l.marca();
  l.palabra(...ARTICULOS);
  const desde = l.marca();
  let n = 0;
  while (n < max) {
    const p = l.ver();
    if (p === undefined || ALTO_REFERENCIA.has(p)) break;
    if (NO_SON_REFERENCIA.has(p) || !palabraDesc(p) || env.nombres.has(p) || env.esAliasCuenta([p])) break;
    l.pos++;
    n++;
  }
  if (n === 0) {
    l.volver(inicio);
    return null;
  }
  return l.original(desde, l.pos);
}

function montoPositivo(l: Lector): Centavos | null {
  const lectura = leerMonto(l);
  return lectura && lectura.monto > 0 ? lectura.monto : null;
}

/** Con una referencia ya leída, la parte que sigue: "fue de 150, no de 120", "fue ayer", "era antojo", "fue a 12 meses". */
function cambio(l: Lector, env: Entorno, texto: string, trasComercio: boolean): Interpretacion | null {
  const inicio = l.marca();
  // ... fue con la de crédito / lo pagué con la Nu
  if (l.palabra(...FUE) || l.alguna(['lo', 'pague'], ['la', 'pague'], ['los', 'pague'], ['las', 'pague'])) {
    const despuesDeFue = l.marca();
    const origen: RefCuenta | null = env.metodo(l);
    if (origen && l.fin) return corregir({ texto }, { origen });
    l.volver(despuesDeFue);
    // ... fue ayer / fue el viernes
    const fecha = leerFechaRegistro(l, env.hoy);
    if (fecha !== null && l.fin) return corregir({ texto }, { fecha });
    l.volver(despuesDeFue);
    // ... fue a 12 meses [sin intereses]
    if (l.palabra('a')) {
      const meses = leerEntero(l, 48);
      if (meses !== null && meses >= 2 && l.palabra('meses', 'msi')) {
        l.alguna(['sin', 'intereses'], ['msi']);
        if (l.fin) return corregir({ texto }, { msi: { meses } });
      }
      l.volver(despuesDeFue);
    }
    // ... fue de 150, no de 120
    if (!trasComercio) {
      l.palabra('de');
      const nuevo = montoPositivo(l);
      if (nuevo !== null) {
        if (l.fin) return corregir({ texto }, { monto: nuevo });
        l.sep();
        if (l.palabra('no')) {
          l.palabra('de');
          const viejo = montoPositivo(l);
          if (viejo !== null && l.fin && viejo !== nuevo)
            return corregir({ texto, monto: viejo }, { monto: nuevo });
        }
      }
      l.volver(despuesDeFue);
      // ... era antojo[, no comida]
      l.palabra('de');
      const categoria: Categoria | null = leerCategoria(l);
      if (categoria !== null) {
        if (l.fin) return corregir({ texto }, { categoria });
        l.sep();
        if (l.palabra('no')) {
          while (!l.fin && palabraDesc(l.ver() ?? '')) l.pos++;
          if (l.fin) return corregir({ texto }, { categoria });
        }
      }
    }
  }
  l.volver(inicio);
  return null;
}

/**
 * CORREGIR := no [,] [art] DESC_REF (fue|fueron|era|es) ...        (texto)
 *           | no [,] (fue|fueron|era|es) [de] MONTO                 (último)
 *           | [lo de] [art] DESC_REF [de COMERCIO] (fue|fueron|era|es|lo pagué) ...
 *   ... := [de] MONTO [, no [de] MONTO] | METODO | FECHA | a N meses [sin intereses] | [de] CATEGORIA [, no …]
 */
export function corregirFrase(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const inicio = l.marca();
  if (l.palabra('no')) {
    l.sep();
    const despuesDeNo = l.marca();
    if (l.palabra(...FUE)) {
      l.palabra('de');
      const monto = montoPositivo(l);
      if (monto !== null && l.fin) return corregir({ ultimo: true }, { monto });
      const origen = env.metodo(l);
      if (origen && l.fin) return corregir({ ultimo: true }, { origen });
      return null;
    }
    l.volver(despuesDeNo);
  } else {
    l.volver(inicio);
    l.alguna(['lo', 'de'], ['lo', 'del']);
  }
  const texto = referencia(l, env);
  if (texto === null) return null;
  let trasComercio = false;
  if (l.ver() === 'de' && l.ver(1) !== undefined && !ARTICULOS.has(l.ver(1) ?? '')) {
    const p = l.pos + 1;
    if (esComercio(tokens, p, p + 1, env)) {
      l.pos = p + 1;
      trasComercio = true;
    }
  }
  return cambio(l, env, texto, trasComercio);
}

/**
 * ANULAR := (borra|elimina|quita|cancela|deshaz) (lo (de|del|de la|de los|de las) DESC_REF | [art] DESC_REF)
 *         | (borra|…) (el último [movimiento|registro|gasto] | lo último)
 */
export function anular(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  if (!l.palabra(...BORRAR)) return null;
  if (l.alguna(...ULTIMO)) {
    l.palabra('pago', 'ingreso', 'cargo', 'abono', 'que', 'anote');
    return l.fin ? { intencion: 'anular', objetivo: { ultimo: true } } : null;
  }
  l.alguna(['lo', 'de', 'la'], ['lo', 'de', 'los'], ['lo', 'de', 'las'], ['lo', 'del'], ['lo', 'de']);
  const texto = referencia(l, env);
  return texto !== null && l.fin ? { intencion: 'anular', objetivo: { texto } } : null;
}

/**
 * DUPLICADOS := [creo que] (anoté|registré|apunté|capturé) dos veces [art] DESC_REF
 *             | [art] DESC_REF (está|salió|aparece) (duplicado|duplicada|dos veces)
 */
export function duplicados(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const inicio = l.marca();
  l.alguna(['creo', 'que'], ['me', 'parece', 'que']);
  if (l.palabra(...ANOTE) && l.secuencia('dos', 'veces')) {
    const texto = referencia(l, env);
    return texto !== null && l.fin ? { intencion: 'revisar_duplicados', filtro: { texto } } : null;
  }
  l.volver(inicio);
  const texto = referencia(l, env);
  if (texto === null || !l.palabra('esta', 'salio', 'aparece')) return null;
  if (!l.alguna(['duplicado'], ['duplicada'], ['dos', 'veces']) || !l.fin) return null;
  return { intencion: 'revisar_duplicados', filtro: { texto } };
}
