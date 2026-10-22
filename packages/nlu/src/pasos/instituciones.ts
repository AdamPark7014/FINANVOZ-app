/**
 * Catálogo de bancos, billeteras y tarjetas de México que los lectores por paso reconocen al dictar
 * (docs/06-NLU.md §13).
 *
 * Criterio:
 * - Entra una institución si en 2026 la gente la nombra por su marca para hablar de dónde tiene su dinero o de qué
 *   tarjeta paga: los bancos grandes, los bancos digitales y las billeteras con tarjeta.
 * - `cuenta` dice qué se crea en el paso de cuentas cuando alguien dice "tengo 500 en X": `debito` para bancos y
 *   bancos digitales, `billetera` para las apps de pago; `null` si solo da crédito. `credito` dice si entra al paso
 *   de tarjeta.
 * - `alias` son las formas en que el dictado la escribe, en forma simple (minúsculas, sin acentos): la marca, su
 *   nombre anterior ("bancomer", "citibanamex") y lo que el reconocedor confunde a menudo ("new" por Nu, "clar" por
 *   Klar). Nunca una palabra común que pueda ser otra cosa en la frase.
 * - `id` es el mismo de `captura.bancos.json` cuando el banco ya está ahí, para que la cuenta creada por voz empate
 *   con sus notificaciones (`07 §2`).
 * - Lo que no está aquí da `null`: la persona lo escribe. No se adivina un banco por parecido.
 */
import type { CuentaContexto } from '../contexto';
import type { Lector } from '../reglas/lector';
import { formaSimple } from '../reglas/tokens';

export interface Institucion {
  readonly id: string;
  readonly nombre: string;
  readonly alias: readonly string[];
  readonly cuenta: 'debito' | 'billetera' | null;
  readonly credito: boolean;
}

export const INSTITUCIONES: readonly Institucion[] = [
  {
    id: 'bbva_mx',
    nombre: 'BBVA',
    alias: ['bbva', 'bancomer', 'bbva bancomer'],
    cuenta: 'debito',
    credito: true,
  },
  { id: 'banorte', nombre: 'Banorte', alias: ['banorte'], cuenta: 'debito', credito: true },
  { id: 'santander_mx', nombre: 'Santander', alias: ['santander'], cuenta: 'debito', credito: true },
  {
    id: 'banamex',
    nombre: 'Banamex',
    alias: ['banamex', 'citibanamex', 'citi banamex', 'citi'],
    cuenta: 'debito',
    credito: true,
  },
  { id: 'hsbc_mx', nombre: 'HSBC', alias: ['hsbc'], cuenta: 'debito', credito: true },
  {
    id: 'scotiabank_mx',
    nombre: 'Scotiabank',
    alias: ['scotiabank', 'scotia'],
    cuenta: 'debito',
    credito: true,
  },
  { id: 'inbursa', nombre: 'Inbursa', alias: ['inbursa'], cuenta: 'debito', credito: true },
  {
    id: 'banco_azteca',
    nombre: 'Banco Azteca',
    alias: ['banco azteca', 'azteca'],
    cuenta: 'debito',
    credito: true,
  },
  {
    id: 'bancoppel',
    nombre: 'BanCoppel',
    alias: ['bancoppel', 'ban coppel', 'coppel'],
    cuenta: 'debito',
    credito: true,
  },
  {
    id: 'nu_mx',
    nombre: 'Nu',
    alias: ['nu', 'new', 'nubank', 'nu bank', 'nu mexico'],
    cuenta: 'debito',
    credito: true,
  },
  {
    id: 'mercado_pago',
    nombre: 'Mercado Pago',
    alias: ['mercado pago', 'mercadopago'],
    cuenta: 'billetera',
    credito: true,
  },
  {
    id: 'spin_oxxo',
    nombre: 'Spin by OXXO',
    alias: ['spin', 'spin by oxxo', 'spin oxxo'],
    cuenta: 'billetera',
    credito: false,
  },
  { id: 'hey_banco', nombre: 'Hey Banco', alias: ['hey banco', 'hey'], cuenta: 'debito', credito: true },
  { id: 'klar', nombre: 'Klar', alias: ['klar', 'clar'], cuenta: 'debito', credito: true },
  { id: 'stori', nombre: 'Stori', alias: ['stori'], cuenta: 'debito', credito: true },
  { id: 'didi', nombre: 'DiDi', alias: ['didi', 'didi card'], cuenta: 'billetera', credito: true },
  {
    id: 'rappi',
    nombre: 'Rappi',
    alias: ['rappi', 'rappicard', 'rappi card', 'rappipay'],
    cuenta: 'billetera',
    credito: true,
  },
  { id: 'uala', nombre: 'Ualá', alias: ['uala'], cuenta: 'billetera', credito: true },
  { id: 'vexi', nombre: 'Vexi', alias: ['vexi'], cuenta: null, credito: true },
  { id: 'plata', nombre: 'Plata', alias: ['plata card', 'plata'], cuenta: null, credito: true },
];

const MAX_PALABRAS = 3;

export type Uso = 'cuenta' | 'credito';

const sirve = (i: Institucion, uso: Uso) => (uso === 'cuenta' ? i.cuenta !== null : i.credito);

/** Institución cuyo alias es exactamente `dicho` (en forma simple). */
export function institucionPorAlias(dicho: string, uso?: Uso): Institucion | undefined {
  const forma = formaSimple(dicho);
  return INSTITUCIONES.find((i) => (uso === undefined || sirve(i, uso)) && i.alias.includes(forma));
}

/** Lee una institución en el cursor (el alias más largo que coincida); `null` sin mover el cursor si no hay. */
export function leerInstitucion(l: Lector, uso: Uso): Institucion | null {
  for (let n = Math.min(MAX_PALABRAS, l.largo - l.pos); n >= 1; n--) {
    const dicho = l.t.slice(l.pos, l.pos + n).join(' ');
    const i = institucionPorAlias(dicho, uso);
    if (i) {
      l.pos += n;
      return i;
    }
  }
  return null;
}

/**
 * Las instituciones de un uso como cuentas del contexto, para que el nivel 0 (`interpretarReglas`) las reconozca
 * como alias ("tengo 4,200 en BBVA" en el paso de cuentas, "mi Nu corta el 28" en el de tarjeta). Una institución
 * cuyo alias ya es de una cuenta real no se agrega: gana la cuenta que la persona ya tiene.
 */
export function cuentasDelCatalogo(uso: Uso, reales: readonly CuentaContexto[]): CuentaContexto[] {
  const ocupados = new Set(reales.flatMap((c) => c.alias.map((a) => formaSimple(a))));
  return INSTITUCIONES.filter((i) => sirve(i, uso) && !i.alias.some((a) => ocupados.has(a))).map((i) => ({
    tipo: uso === 'credito' ? 'credito' : (i.cuenta ?? 'debito'),
    alias: i.alias,
    espacio: 'personal',
  }));
}
