/**
 * Lo que el nivel 0 sabe del contexto (docs/06-NLU.md §4): cuentas con sus alias, contactos, clientes, fechas y si
 * el negocio está activo. Resuelve alias, métodos de pago y nombres de persona sobre un `Lector`.
 */
import type { ContextoInterprete, CuentaContexto } from '../contexto';
import type { Categoria, RefCuenta } from '../esquema';
import { normalizarAlias } from '../normalizar';
import { buscarEnDiccionario, FAMILIA } from './diccionario';
import type { Lector } from './lector';
import {
  ARTICULOS,
  PALABRAS_PROHIBIDAS_DESC,
  PALABRAS_QUE_DESCARTAN,
  formaSimple,
  palabraDesc,
} from './tokens';

export type TipoRef = RefCuenta['tipo'];

const MAX_PALABRAS_ALIAS = 4;
const PREFIJOS_ALIAS: readonly (readonly string[])[] = [
  ['mi', 'cuenta', 'de'],
  ['la', 'cuenta', 'de'],
  ['mi', 'tarjeta'],
  ['la', 'tarjeta'],
  ['la', 'de'],
  ['la'],
  ['el'],
  ['mi'],
];
const NO_SON_NOMBRES = new Set([
  'yo',
  'tu',
  'mi',
  'su',
  'el',
  'ella',
  'ellos',
  'ellas',
  'nosotros',
  'todo',
  'todos',
  'alguien',
  'nadie',
]);
const HONORIFICOS = new Set(['don', 'doña']);

export class Entorno {
  readonly hoy: string;
  readonly cuentas: readonly CuentaContexto[];
  /** Alias de contactos y clientes en forma simple. */
  readonly nombres: Set<string>;
  readonly clientes: Set<string>;
  readonly negocio: boolean;
  readonly ultimoIngreso: string | undefined;
  readonly proximoIngreso: string | undefined;
  /** Alias de cada contacto en forma simple (un arreglo por contacto). */
  private readonly contactos: readonly (readonly string[])[];

  constructor(contexto: ContextoInterprete) {
    this.hoy = contexto.fecha_referencia;
    this.cuentas = contexto.cuentas;
    this.contactos = (contexto.contactos ?? []).map((alias) => alias.map((a) => formaSimple(a)));
    this.clientes = new Set((contexto.clientes ?? []).flat().map((a) => formaSimple(a)));
    this.nombres = new Set([
      ...(contexto.contactos ?? []).flat().map((a) => formaSimple(a)),
      ...this.clientes,
    ]);
    this.negocio = contexto.espacios.includes('negocio');
    this.ultimoIngreso = contexto.ultimo_ingreso;
    this.proximoIngreso = contexto.proximo_ingreso;
  }

  /** Un tramo de palabras es un alias de cuenta dicho tal cual. */
  esAliasCuenta(palabras: readonly string[]): boolean {
    const dicho = palabras.join(' ');
    return this.cuentas.some((c) => c.alias.some((a) => formaSimple(a) === dicho));
  }

  esNombreConocido(palabras: readonly string[]): boolean {
    return this.nombres.has(palabras.join(' '));
  }

  esCliente(palabras: readonly string[]): boolean {
    return this.clientes.has(palabras.join(' '));
  }

  /**
   * ALIAS del contexto, dicho tal cual, con prefijo opcional ("la", "la de", "mi tarjeta", "mi cuenta de"). Se toma el
   * tramo más largo que coincida. Si el alias es de cuentas de tipos distintos, no se adivina. `tipos` acota.
   */
  alias(l: Lector, tipos?: readonly TipoRef[]): RefCuenta | null {
    const inicio = l.marca();
    for (const prefijo of [...PREFIJOS_ALIAS, []]) {
      l.volver(inicio);
      if (!l.secuencia(...prefijo)) continue;
      const ref = this.aliasSinPrefijo(l);
      if (ref && (!tipos || tipos.includes(ref.tipo))) return ref;
    }
    l.volver(inicio);
    return null;
  }

  private aliasSinPrefijo(l: Lector): RefCuenta | null {
    const inicio = l.marca();
    for (let n = Math.min(MAX_PALABRAS_ALIAS, l.largo - inicio); n >= 1; n--) {
      const dicho = l.t.slice(inicio, inicio + n).join(' ');
      const tiposCuenta = new Set(
        this.cuentas.filter((c) => c.alias.some((a) => formaSimple(a) === dicho)).map((c) => c.tipo),
      );
      const [tipoCuenta] = tiposCuenta;
      if (tiposCuenta.size !== 1 || tipoCuenta === undefined) continue;
      const alias = normalizarAlias(dicho);
      if (alias === '') continue;
      l.pos = inicio + n;
      return { tipo: tipoCuenta === 'billetera' ? 'debito' : tipoCuenta, alias };
    }
    return null;
  }

  /**
   * METODO := (en|con) (efectivo | cash | billetes) | (con|en|por) (débito | la de débito | transferencia)
   *         | (con|en) (la de crédito | crédito) | (con|en) [la] tarjeta | (con|en) [prefijo] ALIAS
   * Con "en", un alias de efectivo no vale ("en la tienda" es un lugar, no un método).
   */
  metodo(l: Lector): RefCuenta | null {
    const inicio = l.marca();
    const conector = l.ver();
    if (conector === undefined || !['en', 'con', 'por'].includes(conector)) return null;
    l.pos++;
    if (conector === 'por') {
      if (l.palabra('transferencia')) return { tipo: 'debito' };
      l.volver(inicio);
      return null;
    }
    if (l.palabra('efectivo', 'cash', 'billetes')) return { tipo: 'efectivo' };
    if (l.alguna(['la', 'de', 'debito'], ['debito'], ['transferencia'], ['tarjeta', 'de', 'debito'])) {
      return { tipo: 'debito' };
    }
    if (l.alguna(['la', 'de', 'credito'], ['credito'], ['tarjeta', 'de', 'credito']))
      return { tipo: 'credito' };
    if (l.alguna(['la', 'tarjeta'], ['tarjeta'])) return { tipo: 'tarjeta' };
    const ref = this.alias(l);
    if (ref && (conector === 'con' || ref.tipo !== 'efectivo')) return ref;
    l.volver(inicio);
    return null;
  }

  /** Una palabra que puede ser nombre de persona: conocida, o desconocida pero que no es nada más. */
  esNombre(p: string): boolean {
    if (this.nombres.has(p)) return true;
    return (
      p.length >= 2 &&
      palabraDesc(p) &&
      !ARTICULOS.has(p) &&
      !NO_SON_NOMBRES.has(p) &&
      !buscarEnDiccionario([p]).cubiertas.every(Boolean) &&
      !this.esAliasCuenta([p])
    );
  }

  /**
   * PERSONA := [mi|la|el|a] [don|doña] NOMBRE (1 o 2 palabras). Devuelve la contraparte tal como se dijo (sin el
   * artículo) y si es un cliente del fiado.
   */
  persona(l: Lector): { contraparte: string; cliente: boolean } | null {
    const inicio = l.marca();
    l.palabra('mi', 'la', 'el');
    const desde = l.marca();
    const honorifico = l.ver();
    if (honorifico !== undefined && HONORIFICOS.has(honorifico)) l.pos++;
    for (const n of [2, 1]) {
      const palabras = l.t.slice(l.pos, l.pos + n);
      if (palabras.length !== n) continue;
      const completo = l.t.slice(desde, l.pos + n);
      const conocido = this.esNombreConocido(palabras) || this.esNombreConocido(completo);
      if (conocido || palabras.every((p) => this.esNombre(p) && !PALABRAS_PROHIBIDAS_DESC.has(p))) {
        if (!conocido && n === 2) continue; // dos palabras desconocidas no forman un nombre seguro
        l.pos += n;
        return {
          contraparte: l.original(desde, l.pos),
          cliente: this.esCliente(palabras) || this.esCliente(completo),
        };
      }
    }
    l.volver(inicio);
    return null;
  }

  /**
   * La persona es un familiar: un parentesco dicho ("mi tía", "mi jefa") o un contacto que tiene un alias de
   * parentesco (el contacto Mamá con alias "jefa"). Para `apoyo_familiar` (06 §3.1).
   */
  esFamiliar(contraparte: string): boolean {
    const dicho = formaSimple(contraparte);
    if (dicho.split(' ').some((p) => FAMILIA.has(p))) return true;
    return this.contactos.some((alias) => alias.includes(dicho) && alias.some((a) => FAMILIA.has(a)));
  }

  /** Categoría del negocio para una palabra, solo con negocio activo. */
  categoriaNegocio(p: string): Categoria | null {
    if (!this.negocio) return null;
    if (p === 'mercancia') return 'mercancia';
    if (p === 'insumos') return 'insumos';
    return null;
  }

  /** Palabra que no desvía el sentido de una frase: letras, sin fechas, pagos, deudas ni negocio. */
  palabraLibre(p: string): boolean {
    return /^[a-zñ]+$/.test(p) && !PALABRAS_QUE_DESCARTAN.has(p) && !this.esAliasCuenta([p]);
  }
}
