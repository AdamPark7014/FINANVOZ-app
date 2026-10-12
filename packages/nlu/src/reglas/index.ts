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

class Analizador {
  private readonly tokens: string[];
  private readonly originales: string[];
  private readonly fecha: string;
  private readonly cuentas: readonly CuentaContexto[];
  private readonly nombres: Set<string>;

  constructor(texto: string, contexto: ContextoInterprete) {
    const normalizada = normalizarFrase(texto);
    this.tokens = normalizada === '' ? [] : normalizada.split(' ');
    // Mismos cortes que `tokens`, conservando acentos, para la descripción.
    const original = texto
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[¿¡\s]+/, '')
      .replace(/[\s.,;:!?¡¿]+$/, '');
    const originales = original === '' ? [] : original.split(' ');
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

  /**
   * DESC := 1 a 3 palabras después de quitar un artículo inicial, sin palabras de enlace; categoría por diccionario.
   * Con `conocida` (DESC_CONOCIDA, forma sin verbo) todas sus palabras deben estar en el diccionario.
   */
  private desc(
    inicio: number,
    fin: number,
    conocida: boolean,
  ): { descripcion: string; categoria?: Categoria } | null {
    let desde = inicio;
    if (fin - desde > 1 && ARTICULOS.has(this.tokens[desde] ?? '')) desde++;
    const palabras = this.tokens.slice(desde, fin);
    if (palabras.length < 1 || palabras.length > 3) return null;
    for (const p of palabras) {
      if (!/^[a-zñ]+$/.test(p) || PALABRAS_PROHIBIDAS_DESC.has(p) || PALABRAS_QUE_DESCARTAN.has(p))
        return null;
      if (this.nombres.has(p)) return null;
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
    const descripcion = this.originales.slice(desde, fin).join(' ');
    const [categoria] = categorias;
    return categorias.size === 1 && categoria ? { descripcion, categoria } : { descripcion };
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
