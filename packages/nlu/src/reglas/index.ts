/**
 * Nivel 0 · gramática de reglas (docs/06-NLU.md §9). Responde solo si está seguro; cualquier otra cosa → `null`.
 * Corre en el teléfono, sin red. Nunca registra en logs el texto ni los montos (regla 9).
 */
import type { Centavos } from '@cartera/core';
import type { ContextoInterprete, CuentaContexto } from '../contexto';
import type { Categoria, Interpretacion, Movimiento, RefCuenta } from '../esquema';
import { normalizarAlias } from '../normalizar';
import { buscarEnDiccionario } from './diccionario';

const ARTICULOS = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las']);
const PALABRAS_PROHIBIDAS_DESC = new Set([
  'por',
  'con',
  'en',
  'de',
  'del',
  'para',
  'a',
  'al',
  'y',
  'que',
  'me',
  'te',
  'se',
  'le',
  'nos',
]);

/**
 * Salvaguardas del nivel 0 (más estrictas que la gramática, nunca más laxas): una `DESC` con alguna de estas palabras
 * no se toma como gasto, porque la frase habla de fechas relativas, de cómo se pagó, de deudas, tandas o del negocio.
 * Esas frases van al nivel 2.
 */
const PALABRAS_QUE_DESCARTAN = new Set([
  // fechas relativas
  'hoy',
  'ayer',
  'anoche',
  'antier',
  'anteayer',
  'hace',
  'manana',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'semana',
  'mes',
  'pasado',
  'pasada',
  'quincena',
  // medios de pago, deudas y otros tipos de movimiento
  'efectivo',
  'cash',
  'debito',
  'credito',
  'tarjeta',
  'cajero',
  'transferencia',
  'deposito',
  'minimo',
  'mensualidad',
  'meses',
  'msi',
  'prestamo',
  'deuda',
  'abono',
  'tanda',
  'nomina',
  'sueldo',
  // negocio
  'tienda',
  'negocio',
  'caja',
  'cliente',
  'clientes',
  'mercancia',
  'local',
  'insumos',
  'fiado',
]);

const VERBOS: readonly (readonly string[])[] = [
  ['me', 'compre'],
  ['compre'],
  ['me', 'eche'],
  ['gaste'],
  ['pague'],
];
const PATRON_MONTO = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;
const MAX_DIGITOS_ENTEROS = 9;

/** Unen dos partes de una `DESC_CONOCIDA` compuesta ("consulta con el médico", "medicinas de la farmacia"). */
const CONECTORES_DESC = new Set(['con', 'de', 'del', 'en']);
/** Entre el monto y la descripción de un gasto compartido ("500 en gasolina", "300 del cine", "luz de 900"). */
const CONECTORES_MONTO = new Set(['de', 'del', 'en', 'por']);

const PAREJA = ['pareja', 'esposa', 'esposo', 'novia', 'novio'];
/** Señales de que el gasto es compartido con la pareja (`02 §27`); sin una de ellas no es `gasto_compartido`. */
const MARCAS_COMPARTIDO: readonly (readonly string[])[] = [
  ['gasto', 'compartido'],
  ['compartido'],
  ['compartida'],
  ['mitad', 'y', 'mitad'],
  ['a', 'medias'],
  ...PAREJA.map((p) => ['con', 'mi', p]),
];
const PAGUE_YO: readonly (readonly string[])[] = [
  ['lo', 'pague', 'yo'],
  ['pague', 'yo'],
  ['yo', 'pague'],
  ['lo', 'pague'],
  ['pague'],
];
const PAGO_PAREJA: readonly (readonly string[])[] = [
  ...['ella', 'el'].flatMap((x) => [
    ['lo', 'pago', x],
    ['pago', x],
  ]),
  ...PAREJA.flatMap((p) => [
    ['lo', 'pago', 'mi', p],
    ['pago', 'mi', p],
  ]),
];
const NO_SON_NOMBRES = new Set([
  'yo',
  'tu',
  'mi',
  'su',
  'ella',
  'ellos',
  'ellas',
  'nosotros',
  'todo',
  'todos',
]);
/** "60/40": las dos partes, de 1 a 99 y que sumen 100. */
const PATRON_PROPORCION = /^(\d{1,2})\/(\d{1,2})$/;

/** Minúsculas y sin acentos, pero conservando la ñ ("uñas" no es "unas"). */
function sinAcentosConEnie(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/(?<!n)̃|(?!̃)\p{Mn}/gu, '')
    .normalize('NFC');
}

/** Minúsculas, sin acentos (la ñ se conserva), sin puntuación inicial ni final, espacios simples. */
function normalizarFrase(texto: string): string {
  return sinAcentosConEnie(texto)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¿¡\s]+/, '')
    .replace(/[\s.,;:!?¡¿]+$/, '');
}

/** Alias en forma comparable sin quitar palabras: minúsculas, sin acentos, sin signos. */
function formaSimple(s: string): string {
  return sinAcentosConEnie(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function leerMonto(token: string | undefined): Centavos | null {
  if (token === undefined) return null;
  const partes = PATRON_MONTO.exec(token);
  if (!partes) return null;
  const enteros = (partes[1] ?? '').replace(/,/g, '').replace(/^0+(?=\d)/, '');
  if (enteros.length > MAX_DIGITOS_ENTEROS) return null;
  const decimales = (partes[2] ?? '').padEnd(2, '0');
  return Number(enteros) * 100 + Number(decimales);
}

const esMonto = (token: string | undefined) => leerMonto(token) !== null;

function empiezaCon(tokens: readonly string[], desde: number, palabras: readonly string[]): boolean {
  return palabras.every((p, k) => tokens[desde + k] === p);
}

function iguales(tokens: readonly string[], palabras: readonly string[]): boolean {
  return tokens.length === palabras.length && empiezaCon(tokens, 0, palabras);
}

/** Palabra que puede ir en una `DESC`: solo letras y ninguna de enlace, de fecha, de pago, de deuda o de negocio. */
function palabraDesc(p: string): boolean {
  return /^[a-zñ]+$/.test(p) && !PALABRAS_PROHIBIDAS_DESC.has(p) && !PALABRAS_QUE_DESCARTAN.has(p);
}

/** Corta en palabras; con `sinComas`, las comas que separan partes de la frase ("1,200, pagué yo") se quitan. */
function partir(frase: string, sinComas: boolean): string[] {
  const limpia = sinComas ? frase.replace(/,(?=\s|$)/g, '').trim() : frase;
  return limpia === '' ? [] : limpia.split(' ');
}

class Analizador {
  private readonly tokens: string[];
  private readonly originales: string[];
  private readonly normalizada: string;
  private readonly original: string;
  private readonly fecha: string;
  private readonly cuentas: readonly CuentaContexto[];
  private readonly nombres: Set<string>;

  constructor(texto: string, contexto: ContextoInterprete) {
    this.normalizada = normalizarFrase(texto);
    this.tokens = partir(this.normalizada, false);
    // Mismos cortes que `tokens`, conservando acentos, para la descripción.
    this.original = texto
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[¿¡\s]+/, '')
      .replace(/[\s.,;:!?¡¿]+$/, '');
    const originales = partir(this.original, false);
    this.originales = originales.length === this.tokens.length ? originales : this.tokens;
    this.fecha = contexto.fecha_referencia;
    this.cuentas = contexto.cuentas;
    this.nombres = new Set(
      [...(contexto.contactos ?? []), ...(contexto.clientes ?? [])].flat().map((a) => formaSimple(a)),
    );
  }

  interpretar(): Interpretacion | null {
    const t = this.tokens;
    if (t.length === 0) return null;
    // Con una señal de gasto compartido la frase es eso o nada: nunca se registra como gasto personal.
    const compartido = this.compartido();
    if (compartido !== undefined) return compartido;
    // Exactamente un monto por frase; ningún otro token con dígitos.
    const conDigitos = t.filter((x) => /\d/.test(x));
    if (conDigitos.length > 1) return null;
    if (conDigitos.length === 1 && !esMonto(conDigitos[0])) return null;
    return (
      this.consulta() ??
      this.arqueo() ??
      this.retiro() ??
      this.ingreso() ??
      this.pagoTarjeta() ??
      this.gasto()
    );
  }

  // CONSULTA := cuánto puedo gastar [hoy]
  private consulta(): Interpretacion | null {
    const t = this.tokens;
    if (iguales(t, ['cuanto', 'puedo', 'gastar']) || iguales(t, ['cuanto', 'puedo', 'gastar', 'hoy'])) {
      return { intencion: 'consultar', consulta: { tipo: 'hoy_puedes' } };
    }
    return null;
  }

  // ARQUEO := traigo MONTO en (la cartera | efectivo)
  private arqueo(): Interpretacion | null {
    const t = this.tokens;
    if (t[0] !== 'traigo' || t[2] !== 'en') return null;
    const resto = t.slice(3);
    if (!iguales(resto, ['la', 'cartera']) && !iguales(resto, ['efectivo'])) return null;
    const monto = leerMonto(t[1]);
    if (monto === null) return null;
    return { intencion: 'arqueo', efectivo_real: monto };
  }

  // RETIRO := saqué MONTO del cajero
  private retiro(): Interpretacion | null {
    const t = this.tokens;
    if (t.length !== 4 || t[0] !== 'saque' || t[2] !== 'del' || t[3] !== 'cajero') return null;
    const monto = leerMonto(t[1]);
    if (!monto) return null;
    return this.registrar({
      tipo: 'retiro_efectivo',
      monto,
      fecha: this.fecha,
      origen: { tipo: 'debito' },
      destino: { tipo: 'efectivo' },
    });
  }

  // INGRESO := me depositaron MONTO | me cayó la quincena[,] MONTO
  private ingreso(): Interpretacion | null {
    const t = this.tokens;
    if (t.length === 3 && empiezaCon(t, 0, ['me', 'depositaron'])) {
      const monto = leerMonto(t[2]);
      if (!monto) return null;
      return this.registrar({ tipo: 'ingreso', monto, fecha: this.fecha, destino: { tipo: 'debito' } });
    }
    if (
      t.length === 5 &&
      empiezaCon(t, 0, ['me', 'cayo', 'la']) &&
      (t[3] === 'quincena' || t[3] === 'quincena,')
    ) {
      const monto = leerMonto(t[4]);
      if (!monto) return null;
      return this.registrar({ tipo: 'ingreso', monto, fecha: this.fecha });
    }
    return null;
  }

  // PAGO_TDC := pagué MONTO de [la] ALIAS_CREDITO
  private pagoTarjeta(): Interpretacion | null {
    const t = this.tokens;
    if (t[0] !== 'pague' || t[2] !== 'de') return null;
    const monto = leerMonto(t[1]);
    if (!monto) return null;
    const ref = this.alias(t.slice(t[3] === 'la' ? 4 : 3));
    if (!ref || ref.tipo !== 'credito') return null;
    return this.registrar({
      tipo: 'pago_tarjeta',
      monto,
      fecha: this.fecha,
      origen: { tipo: 'desconocido' },
      destino: ref,
    });
  }

  /**
   * GASTO := VERBO DESC [de|por|en]? MONTO [pesos]? [METODO]?
   *        | DESC_CONOCIDA [de|por|en]? MONTO [pesos]? [METODO]?
   *        | VERBO MONTO (de|en) DESC [METODO]?
   *        | MONTO (de|del|en) DESC_CONOCIDA [METODO]?
   */
  private gasto(): Interpretacion | null {
    const t = this.tokens;
    const cortes: { fin: number; origen: RefCuenta }[] = [{ fin: t.length, origen: { tipo: 'desconocido' } }];
    for (let k = 1; k < t.length - 1; k++) {
      if (t[k] !== 'en' && t[k] !== 'con') continue;
      const origen = this.metodo(t.slice(k + 1));
      if (origen) cortes.push({ fin: k, origen });
    }
    const formas = [
      (fin: number) => this.gastoConVerbo(fin),
      (fin: number) => this.gastoSinVerbo(fin),
      (fin: number) => this.gastoMontoPrimero(fin),
      (fin: number) => this.gastoMontoSinVerbo(fin),
    ];
    for (const forma of formas) {
      for (const { fin, origen } of cortes) {
        const parcial = forma(fin);
        if (parcial) return this.registrar({ tipo: 'gasto', fecha: this.fecha, ...parcial, origen });
      }
    }
    return null;
  }

  private verbo(): number {
    const encontrado = VERBOS.find((v) => empiezaCon(this.tokens, 0, v));
    return encontrado ? encontrado.length : 0;
  }

  /** `DESC [de|por|en]? MONTO [pesos]?` en `[inicio, fin)`. */
  private descYMonto(inicio: number, fin: number, conocida: boolean): ParcialGasto | null {
    const t = this.tokens;
    let finMonto = fin;
    if (t[finMonto - 1] === 'pesos') finMonto--;
    const posMonto = finMonto - 1;
    const monto = leerMonto(t[posMonto]);
    if (!monto || posMonto <= inicio) return null;
    let finDesc = posMonto;
    const conector = t[finDesc - 1];
    if (conector === 'de' || conector === 'por' || conector === 'en') finDesc--;
    const desc = this.desc(inicio, finDesc, conocida);
    return desc ? { monto, ...desc } : null;
  }

  private gastoConVerbo(fin: number): ParcialGasto | null {
    const largo = this.verbo();
    return largo === 0 ? null : this.descYMonto(largo, fin, false);
  }

  private gastoSinVerbo(fin: number): ParcialGasto | null {
    return this.verbo() !== 0 ? null : this.descYMonto(0, fin, true);
  }

  private gastoMontoPrimero(fin: number): ParcialGasto | null {
    const t = this.tokens;
    const largo = this.verbo();
    if (largo === 0) return null;
    const monto = leerMonto(t[largo]);
    if (!monto || (t[largo + 1] !== 'de' && t[largo + 1] !== 'en')) return null;
    const desc = this.desc(largo + 2, fin, false);
    return desc ? { monto, ...desc } : null;
  }

  /** `MONTO (de|del|en) DESC_CONOCIDA` en `[0, fin)`: "800 de la consulta con el médico". */
  private gastoMontoSinVerbo(fin: number): ParcialGasto | null {
    const t = this.tokens;
    if (this.verbo() !== 0) return null;
    const monto = leerMonto(t[0]);
    if (!monto || (t[1] !== 'de' && t[1] !== 'del' && t[1] !== 'en')) return null;
    const desc = this.desc(2, fin, true);
    return desc ? { monto, ...desc } : null;
  }

  /**
   * DESC := 1 a 3 palabras después de quitar un artículo inicial, sin palabras de enlace; categoría por diccionario.
   * Con `conocida` (DESC_CONOCIDA, forma sin verbo) todas sus palabras deben estar en el diccionario.
   * Además, en cualquier forma: `A (con|de|del|en) [artículo] B` ("consulta con el médico") si `A` y `B` salen
   * completas del diccionario y son de una sola categoría.
   */
  private desc(
    inicio: number,
    fin: number,
    conocida: boolean,
  ): { descripcion: string; categoria?: Categoria } | null {
    let desde = inicio;
    if (fin - desde > 1 && ARTICULOS.has(this.tokens[desde] ?? '')) desde++;
    const palabras = this.tokens.slice(desde, fin);
    const descripcion = this.originales.slice(desde, fin).join(' ');
    const conector = palabras.findIndex((p) => CONECTORES_DESC.has(p));
    if (conector !== -1) {
      const categoria = this.descCompuesta(palabras.slice(0, conector), palabras.slice(conector + 1));
      return categoria ? { descripcion, categoria } : null;
    }
    if (palabras.length < 1 || palabras.length > 3) return null;
    for (const p of palabras) {
      if (!palabraDesc(p) || this.nombres.has(p)) return null;
    }
    const unidas = palabras.join(' ');
    if (
      this.nombres.has(unidas) ||
      this.cuentas.some((c) => c.alias.some((a) => formaSimple(a) === unidas))
    ) {
      return null;
    }
    const { categorias, cubiertas } = buscarEnDiccionario(palabras);
    if (conocida && !cubiertas.every(Boolean)) return null;
    const [categoria] = categorias;
    return categorias.size === 1 && categoria ? { descripcion, categoria } : { descripcion };
  }

  /** Categoría de `A conector [artículo] B`, o `null` si alguna palabra no es del diccionario o hay dos categorías. */
  private descCompuesta(antes: readonly string[], despues: readonly string[]): Categoria | null {
    const b = despues.length > 1 && ARTICULOS.has(despues[0] ?? '') ? despues.slice(1) : despues;
    const palabras = [...antes, ...b];
    if (antes.length < 1 || b.length < 1 || palabras.length > 3) return null;
    if (palabras.some((p) => !palabraDesc(p) || this.nombres.has(p))) return null;
    const { categorias, cubiertas } = buscarEnDiccionario(palabras);
    const [categoria] = categorias;
    return cubiertas.every(Boolean) && categorias.size === 1 && categoria ? categoria : null;
  }

  /**
   * GASTO_COMPARTIDO (`02 §27`): una SEÑAL y, en cualquier orden, [PAGADOR] [PROPORCION] y
   * `[de|por]? MONTO [de|del|en|por]? DESC_CONOCIDA` o `DESC_CONOCIDA [de|del|en|por]? MONTO`.
   *   SEÑAL      := PROPORCION | [gasto] compartido | compartida | mitad y mitad | a medias | con mi pareja
   *   PAGADOR    := [lo] pagué [yo] | yo pagué | [lo] pagó (ella | él | mi pareja | NOMBRE)
   *   PROPORCION := A/B con A + B = 100; A es tu parte si pagaste tú
   *   MONTO      := MONTO de GASTO | 1 a 3 dígitos seguidos de "mil"
   * `undefined` si no hay señal (la frase sigue a las demás reglas); `null` si la hay pero no está seguro. Si pagó tu
   * pareja y el reparto no es parejo, no adivina de quién es cada parte (`null`).
   */
  private compartido(): Interpretacion | null | undefined {
    const t = partir(this.normalizada, true);
    const o = partir(this.original, true);
    const originales = o.length === t.length ? o : t;
    const usados = t.map(() => false);
    const quitar = (secuencia: readonly string[]): number => {
      for (let i = 0; i + secuencia.length <= t.length; i++) {
        if (secuencia.every((p, k) => t[i + k] === p && !usados[i + k])) {
          for (let k = 0; k < secuencia.length; k++) usados[i + k] = true;
          return i;
        }
      }
      return -1;
    };

    const proporciones = t.flatMap((x, i) => {
      const m = PATRON_PROPORCION.exec(x);
      return m ? [{ i, a: Number(m[1]), b: Number(m[2]) }] : [];
    });
    let senal = proporciones.length > 0;
    for (const marca of MARCAS_COMPARTIDO) if (quitar(marca) !== -1) senal = true;
    if (!senal) return undefined;

    const [proporcion, otra] = proporciones;
    if (otra) return null;
    if (proporcion) {
      if (proporcion.a < 1 || proporcion.b < 1 || proporcion.a + proporcion.b !== 100) return null;
      usados[proporcion.i] = true;
    }

    const pagoYo = PAGUE_YO.some((s) => quitar(s) !== -1);
    let pagoPareja = PAGO_PAREJA.some((s) => quitar(s) !== -1);
    let grupo: string | undefined;
    const posPago = quitar(['pago']);
    if (posPago !== -1) {
      const nombre = t[posPago + 1];
      if (nombre === undefined || usados[posPago + 1] || !this.esNombre(nombre)) return null;
      usados[posPago + 1] = true;
      pagoPareja = true;
      grupo = nombre;
    }
    if (pagoYo && pagoPareja) return null;
    const pagador = pagoYo ? 'yo' : pagoPareja ? 'pareja' : undefined;

    let miParte = 50;
    if (proporcion && proporcion.a !== proporcion.b) {
      if (pagador !== 'yo') return null;
      miParte = proporcion.a;
    }

    const resto = t.flatMap((x, i) => (usados[i] ? [] : [{ x, original: originales[i] ?? x }]));
    const montoYDesc = this.montoYDescCompartido(resto);
    if (!montoYDesc) return null;
    return {
      intencion: 'gasto_compartido',
      gasto: {
        monto: montoYDesc.monto,
        fecha: this.fecha,
        descripcion: montoYDesc.descripcion,
        ...(montoYDesc.categoria ? { categoria: montoYDesc.categoria } : {}),
        ...(pagador ? { pagador } : {}),
        mi_parte: miParte,
        ...(grupo ? { grupo } : {}),
      },
    };
  }

  /** Un nombre de persona dicho después de "pagó": una palabra que no es del diccionario ni de enlace. */
  private esNombre(p: string): boolean {
    if (this.nombres.has(p)) return true;
    return (
      p.length >= 2 &&
      palabraDesc(p) &&
      !ARTICULOS.has(p) &&
      !NO_SON_NOMBRES.has(p) &&
      !buscarEnDiccionario([p]).cubiertas.every(Boolean) &&
      !this.cuentas.some((c) => c.alias.some((a) => formaSimple(a) === p))
    );
  }

  private montoYDescCompartido(
    resto: readonly { x: string; original: string }[],
  ): { monto: Centavos; descripcion: string; categoria?: Categoria } | null {
    const r = resto;
    const posiciones = r.flatMap((p, i) => (/\d/.test(p.x) ? [i] : []));
    const [pos, otra] = posiciones;
    if (pos === undefined || otra !== undefined) return null;
    let monto = leerMonto(r[pos]?.x);
    let largo = 1;
    if (r[pos + 1]?.x === 'mil') {
      monto = /^\d{1,3}$/.test(r[pos]?.x ?? '') ? Number(r[pos]?.x) * 100_000 : null;
      largo = 2;
    }
    if (!monto) return null;
    let desc: typeof r;
    if (pos === 0 || (pos === 1 && (r[0]?.x === 'de' || r[0]?.x === 'por'))) {
      desc = r.slice(pos + largo);
      if (CONECTORES_MONTO.has(desc[0]?.x ?? '')) desc = desc.slice(1);
    } else if (pos + largo === r.length) {
      desc = r.slice(0, pos);
      if (CONECTORES_MONTO.has(desc[desc.length - 1]?.x ?? '')) desc = desc.slice(0, -1);
    } else {
      return null;
    }
    if (desc.length > 1 && ARTICULOS.has(desc[0]?.x ?? '')) desc = desc.slice(1);
    const palabras = desc.map((p) => p.x);
    if (palabras.length < 1 || palabras.length > 3) return null;
    if (palabras.some((p) => !palabraDesc(p) || this.nombres.has(p))) return null;
    const { categorias, cubiertas } = buscarEnDiccionario(palabras);
    if (!cubiertas.every(Boolean)) return null;
    const descripcion = desc.map((p) => p.original).join(' ');
    const [categoria] = categorias;
    return categorias.size === 1 && categoria ? { monto, descripcion, categoria } : { monto, descripcion };
  }

  /** METODO := efectivo | cash | débito | la de débito | la de crédito | tarjeta | [la] ALIAS (sin `en`/`con`). */
  private metodo(resto: readonly string[]): RefCuenta | null {
    if (iguales(resto, ['efectivo']) || iguales(resto, ['cash'])) return { tipo: 'efectivo' };
    if (iguales(resto, ['debito']) || iguales(resto, ['la', 'de', 'debito'])) return { tipo: 'debito' };
    if (iguales(resto, ['la', 'de', 'credito'])) return { tipo: 'credito' };
    if (iguales(resto, ['tarjeta'])) return { tipo: 'tarjeta' };
    return this.alias(resto[0] === 'la' ? resto.slice(1) : resto);
  }

  /** ALIAS del contexto, dicho tal cual. Si el alias es de cuentas de tipos distintos, no se adivina. */
  private alias(palabras: readonly string[]): RefCuenta | null {
    if (palabras.length === 0) return null;
    const dicho = palabras.join(' ');
    const tipos = new Set(
      this.cuentas.filter((c) => c.alias.some((a) => formaSimple(a) === dicho)).map((c) => c.tipo),
    );
    const [tipo] = tipos;
    if (tipos.size !== 1 || tipo === undefined) return null;
    const alias = normalizarAlias(dicho);
    if (alias === '') return null;
    return { tipo: tipo === 'billetera' ? 'debito' : tipo, alias };
  }

  private registrar(movimiento: Movimiento): Interpretacion {
    return { intencion: 'registrar', movimientos: [movimiento] };
  }
}

interface ParcialGasto {
  monto: Centavos;
  descripcion: string;
  categoria?: Categoria;
}

/** Interpreta `texto` con la gramática del nivel 0. Devuelve `null` si no está seguro. */
export function interpretarReglas(texto: string, contexto: ContextoInterprete): Interpretacion | null {
  return new Analizador(texto, contexto).interpretar();
}
