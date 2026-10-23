/**
 * Respuesta hablada a una tarjeta «Entendí» (docs/diseno/OLA-7-ASISTENTE.md §4): tras un registro dudoso dictado, el
 * micrófono escucha un turno y esta gramática del nivel 0 decide si la persona dijo que sí, que no o qué fila cambia.
 * Consume la frase completa; cualquier otra cosa (o dos lecturas posibles) da `null` y la tarjeta espera el toque.
 *
 *   CONFIRMACION := SI | NO | CAMBIO
 *   SI       := AFIRMA ([,] (AFIRMA | CORTESIA))*                 "sí" "dale" "sale" "va" "así es" "sí, porfa" "regístralo"
 *   NO       := NIEGA ([,] (NIEGA | CORTESIA))*                   "no" "nel" "cancela" "mejor no" "no, gracias"
 *   CAMBIO   := [ENTRADA [,]] DATO ([,] [y] DATO)*                cada fila a lo más una vez
 *   ENTRADA  := [ah] no [,] [más bien | pero | mejor] | sí [,] pero | pero | mejor | más bien | perdón
 *   DATO     := [VERBO] VALOR [[,] no [VERBO] VALOR_ANTERIOR]     "eran 40, no 50" (lo anterior se lee y se descarta)
 *   VERBO    := fue | fueron | era | eran | es | son | lo pagué | la pagué | lo compré | la compré | pagué | costó
 *             | salió [en] | me cobraron | ponle | ponlo | ponla | pon | cámbialo a | cámbiala a | cámbiale a
 *   VALOR    := CUENTA                → fila 'cuenta'     "con la Nu" "en efectivo" "la BBVA" "con la de crédito"
 *             | [de] MONTO            → fila 'monto'      interpretado como MONTO (06 §9.1): "40" "como 40" "ochenta y cinco"
 *             | [de|en|a] [la categoría de] [art] CATEGORIA → fila 'categoria'   "comida" "antojos" "súper"
 *             | FECHA                 → fila 'cuando'     06 §9.1 al registrar, con la fecha del contexto: "ayer" "el viernes"
 *
 * - "sí" seguido de un dato sin "pero" ("sí, con la Nu") es ambiguo: `null`. "no, X" en medio de un dato ("eran 40, no,
 *   50") también: la persona se está corrigiendo a sí misma.
 * - La cuenta se lee por alias contra las cuentas del contexto (`Entorno.metodo`/`alias`) o por tipo genérico
 *   ("efectivo", "débito", "crédito"); "con la tarjeta" no dice cuál: `null`.
 * - Categoría por el catálogo de la persona (`04 §2.3`): nombres de `reglas/categorias` y del diccionario. "comida"
 *   sola es Comida fuera, como en el diccionario (`06 §3.1`); los grupos "casa" y "movilidad" no son categoría.
 *   Con `movimiento: 'ingreso'` solo valen las de ingreso; si no, solo las de gasto.
 * - Fechas solo pasadas o de hoy; sin `fecha_referencia` en el contexto, una fecha da `null` (nunca se usa el reloj).
 *
 * Nunca registra en logs el texto ni las cifras (regla 9).
 */
import { z } from 'zod';
import type { CuentaContexto } from '../contexto';
import { Categoria, Fecha, RefCuenta, type Espacio } from '../esquema';
import { leerCategoria } from '../reglas/categorias';
import { Entorno } from '../reglas/entorno';
import { leerFechaRegistro } from '../reglas/fechas';
import { Lector } from '../reglas/lector';
import { leerMonto } from '../reglas/montos';
import { ARTICULOS, SEP, tokenizar } from '../reglas/tokens';

/** Filas de la tarjeta «Entendí» que se pueden cambiar hablando (las claves de `FilaEntendi`). */
export const FILAS_CONFIRMABLES = ['monto', 'cuenta', 'categoria', 'cuando'] as const;
export type FilaConfirmable = (typeof FILAS_CONFIRMABLES)[number];

const CambioConfirmacion = z.discriminatedUnion('fila', [
  z.strictObject({ fila: z.literal('monto'), monto: z.int().min(1), aproximado: z.boolean() }),
  z.strictObject({ fila: z.literal('cuenta'), cuenta: RefCuenta }),
  z.strictObject({ fila: z.literal('categoria'), categoria: Categoria }),
  z.strictObject({ fila: z.literal('cuando'), fecha: Fecha }),
]);
export type CambioConfirmacion = z.infer<typeof CambioConfirmacion>;

/** Esquema de la lectura (también la valida la evaluación). */
export const EsquemaLecturaConfirmacion = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('si') }),
  z.strictObject({ tipo: z.literal('no') }),
  z.strictObject({
    tipo: z.literal('cambio'),
    cambios: z
      .array(CambioConfirmacion)
      .min(1)
      .max(FILAS_CONFIRMABLES.length)
      .refine((c) => new Set(c.map((x) => x.fila)).size === c.length, { message: 'fila repetida' }),
  }),
]);
export type LecturaConfirmacion = z.infer<typeof EsquemaLecturaConfirmacion>;

/**
 * Contexto de la respuesta: el del intérprete (`06 §4`, todo opcional) y lo que muestra la tarjeta. Sin cuentas solo
 * se leen los tipos genéricos; sin `fecha_referencia`, ninguna fecha.
 */
export interface ContextoConfirmacion {
  fecha_referencia?: string;
  espacios?: readonly Espacio[];
  cuentas?: readonly CuentaContexto[];
  contactos?: readonly (readonly string[])[];
  /**
   * Claves de las filas que muestra la tarjeta (`FilaEntendi.clave`): un cambio a otra fila da `null`. Sin la lista,
   * valen las cuatro.
   */
  filas?: readonly string[];
  /** Qué registra la tarjeta: acota las categorías. Por omisión, gasto. */
  movimiento?: 'gasto' | 'ingreso';
}

type Secuencias = readonly (readonly string[])[];

/** Más largas primero: `Lector.alguna` se queda con la primera que coincide. */
const AFIRMA: Secuencias = [
  ['claro', 'que', 'si'],
  ['va', 'que', 'va'],
  ['dejalo', 'asi'],
  ['asi', 'esta', 'bien'],
  ['si', 'señor'],
  ['asi', 'es'],
  ['eso', 'es'],
  ['esta', 'bien'],
  ['esta', 'correcto'],
  ['es', 'correcto'],
  ['todo', 'bien'],
  ['todo', 'correcto'],
  ['de', 'acuerdo'],
  ['si'],
  ['sip'],
  ['simon'],
  ['sale'],
  ['dale'],
  ['va'],
  ['andale'],
  ['orale'],
  ['ok'],
  ['okey'],
  ['okay'],
  ['oki'],
  ['correcto'],
  ['exacto'],
  ['perfecto'],
  ['claro'],
  ['aja'],
  ['eso'],
  ['confirmo'],
  ['confirmado'],
  ['registralo'],
  ['registrala'],
  ['guardalo'],
  ['guardala'],
  ['agregalo'],
  ['agregala'],
  ['anotalo'],
  ['anotala'],
  ['apuntalo'],
  ['apuntala'],
];
const NIEGA: Secuencias = [
  ['no', 'lo', 'registres'],
  ['no', 'la', 'registres'],
  ['no', 'lo', 'guardes'],
  ['no', 'la', 'guardes'],
  ['no', 'lo', 'agregues'],
  ['no', 'la', 'agregues'],
  ['no', 'lo', 'anotes'],
  ['no', 'la', 'anotes'],
  ['no', 'es', 'eso'],
  ['no', 'esta', 'bien'],
  ['no', 'quiero'],
  ['mejor', 'no'],
  ['esta', 'mal'],
  ['asi', 'no'],
  ['para', 'nada'],
  ['no'],
  ['nel'],
  ['nop'],
  ['nope'],
  ['nones'],
  ['cancela'],
  ['cancelalo'],
  ['cancelala'],
  ['cancelar'],
  ['olvidalo'],
  ['olvidala'],
];
const CORTESIA: Secuencias = [['por', 'favor'], ['porfavor'], ['porfa'], ['gracias'], ['pues']];

const VERBOS: Secuencias = [
  ['cambialo', 'a'],
  ['cambiala', 'a'],
  ['cambiale', 'a'],
  ['me', 'cobraron'],
  ['lo', 'pague'],
  ['la', 'pague'],
  ['lo', 'compre'],
  ['la', 'compre'],
  ['salio', 'en'],
  ['fueron'],
  ['fue'],
  ['eran'],
  ['era'],
  ['es'],
  ['son'],
  ['pague'],
  ['costo'],
  ['salio'],
  ['ponle'],
  ['ponlo'],
  ['ponla'],
  ['pon'],
];

/** Tipos genéricos de cuenta dichos sin alias. "la tarjeta" (sin decir cuál) no está: no dice qué fila poner. */
const CUENTA_GENERICA: readonly (readonly [readonly string[], RefCuenta])[] = [
  [['la', 'de', 'debito'], { tipo: 'debito' }],
  [['la', 'de', 'credito'], { tipo: 'credito' }],
  [['tarjeta', 'de', 'debito'], { tipo: 'debito' }],
  [['tarjeta', 'de', 'credito'], { tipo: 'credito' }],
  [['efectivo'], { tipo: 'efectivo' }],
  [['cash'], { tipo: 'efectivo' }],
  [['billetes'], { tipo: 'efectivo' }],
  [['debito'], { tipo: 'debito' }],
  [['credito'], { tipo: 'credito' }],
];

/** Nombres del catálogo (`04 §2.3`) que `leerCategoria` no conoce: los de ingreso y las etiquetas largas. */
const NOMBRES_INGRESO: readonly (readonly [readonly string[], Categoria])[] = [
  [['otros', 'ingresos'], 'otros_ingresos'],
  [['regalo', 'recibido'], 'regalo_recibido'],
  [['sueldo'], 'sueldo'],
  [['honorarios'], 'honorarios'],
  [['ventas'], 'ventas'],
  [['venta'], 'ventas'],
  [['reembolsos'], 'reembolso'],
  [['reembolso'], 'reembolso'],
  [['rendimientos'], 'rendimientos'],
];
const NOMBRES_GASTO_EXTRA: readonly (readonly [readonly string[], Categoria])[] = [
  [['comisiones', 'e', 'intereses'], 'comisiones_intereses'],
  [['comida'], 'comida_fuera'],
];
/** Las de varias palabras primero ("regalo recibido" antes que "regalo" de `leerCategoria`). */
const NOMBRES_PROPIOS = [...NOMBRES_INGRESO, ...NOMBRES_GASTO_EXTRA];
const CATEGORIAS_INGRESO: ReadonlySet<Categoria> = new Set(NOMBRES_INGRESO.map(([, c]) => c));

function alguna(l: Lector, secuencias: Secuencias): boolean {
  return l.alguna(...secuencias);
}

/** SI o NO: la frase completa son piezas de `inicio` (la primera) y de `inicio`/`cortesia` (las demás). */
function soloPiezas(l: Lector, inicio: Secuencias, resto: Secuencias): boolean {
  l.volver(0);
  if (!alguna(l, inicio)) return false;
  while (!l.fin) {
    l.sep();
    if (!alguna(l, inicio) && !alguna(l, resto)) return false;
  }
  return true;
}

class LectorCambio {
  private readonly env: Entorno;
  private readonly hayFecha: boolean;

  constructor(private readonly contexto: ContextoConfirmacion) {
    this.hayFecha = contexto.fecha_referencia !== undefined;
    this.env = new Entorno({
      fecha_referencia: contexto.fecha_referencia ?? '2000-01-01',
      espacios: contexto.espacios ?? ['personal'],
      cuentas: contexto.cuentas ?? [],
      contactos: contexto.contactos ?? [],
    });
  }

  /**
   * CUENTA: método (con/en/por …), o [desde|de] alias con prefijo ("la Nu", "salió de la BBVA") o tipo genérico
   * ("efectivo", "la de débito"). "con la tarjeta" no dice cuál: no es una cuenta.
   */
  private cuenta(l: Lector): RefCuenta | null {
    const inicio = l.marca();
    const metodo = this.env.metodo(l);
    if (metodo) {
      if (metodo.tipo !== 'tarjeta' && metodo.tipo !== 'desconocido') return metodo;
      l.volver(inicio);
      return null;
    }
    for (const conector of [['desde'], ['de'], []]) {
      l.volver(inicio);
      if (!l.secuencia(...conector)) continue;
      const generica = CUENTA_GENERICA.find(([s]) => l.secuencia(...s));
      if (generica) return generica[1];
      const alias = this.env.alias(l);
      if (alias) return alias;
    }
    l.volver(inicio);
    return null;
  }

  /** MONTO > 0, con "de" opcional ("fue de 40"). */
  private monto(l: Lector): { monto: number; aproximado: boolean } | null {
    const inicio = l.marca();
    l.palabra('de');
    const m = leerMonto(l);
    if (m && m.monto > 0) return m;
    l.volver(inicio);
    return null;
  }

  /** CATEGORIA por nombre del catálogo, acotada a gasto o ingreso. */
  private categoria(l: Lector): Categoria | null {
    const inicio = l.marca();
    l.palabra('de', 'en', 'a');
    l.alguna(['la', 'categoria', 'de'], ['la', 'categoria'], ['categoria', 'de'], ['categoria']);
    const despuesDePrefijo = l.marca();
    const ingreso = this.contexto.movimiento === 'ingreso';
    for (const conArticulo of [true, false]) {
      l.volver(despuesDePrefijo);
      if (conArticulo) {
        const art = l.ver();
        if (art === undefined || !ARTICULOS.has(art)) continue;
        l.pos++;
      }
      const propia = NOMBRES_PROPIOS.find(([s]) => l.secuencia(...s));
      const categoria = propia ? propia[1] : leerCategoria(l);
      if (categoria && CATEGORIAS_INGRESO.has(categoria) === ingreso) return categoria;
    }
    l.volver(inicio);
    return null;
  }

  private fecha(l: Lector): string | null {
    if (!this.hayFecha) return null;
    return leerFechaRegistro(l, this.env.hoy);
  }

  /** Un VALOR en el cursor (sin verbo). */
  valor(l: Lector): CambioConfirmacion | null {
    const cuenta = this.cuenta(l);
    if (cuenta) return { fila: 'cuenta', cuenta };
    const monto = this.monto(l);
    if (monto) return { fila: 'monto', monto: monto.monto, aproximado: monto.aproximado };
    const fecha = this.fecha(l);
    if (fecha) return { fila: 'cuando', fecha };
    const categoria = this.categoria(l);
    if (categoria) return { fila: 'categoria', categoria };
    return null;
  }

  /** DATO := [VERBO] VALOR [[,] no [VERBO] VALOR_ANTERIOR de la misma fila]. */
  dato(l: Lector): CambioConfirmacion | null {
    const inicio = l.marca();
    alguna(l, VERBOS);
    const valor = this.valor(l);
    if (!valor) {
      l.volver(inicio);
      return null;
    }
    const despues = l.marca();
    l.sep();
    if (l.palabra('no') && l.ver() !== SEP) {
      alguna(l, VERBOS);
      const anterior = this.valor(l);
      if (anterior?.fila === valor.fila) return valor;
    }
    l.volver(despues);
    return valor;
  }
}

/** ENTRADA del cambio; `false` si la frase arranca con algo que no puede llevar a un cambio ("sí" sin "pero"). */
function entrada(l: Lector): boolean {
  l.volver(0);
  if (!l.secuencia('ah', 'no') && !l.palabra('no')) l.palabra('perdon');
  l.sep();
  if (l.palabra('si')) {
    l.sep();
    if (!l.palabra('pero')) return false;
    l.sep();
    return true;
  }
  if (l.alguna(['mas', 'bien'], ['pero'], ['mejor'])) l.sep();
  return true;
}

function cambio(l: Lector, contexto: ContextoConfirmacion): CambioConfirmacion[] | null {
  if (!entrada(l)) return null;
  const lector = new LectorCambio(contexto);
  const cambios: CambioConfirmacion[] = [];
  while (!l.fin) {
    if (cambios.length > 0) {
      l.sep();
      l.palabra('y');
    }
    const dato = lector.dato(l);
    if (!dato || cambios.some((c) => c.fila === dato.fila)) return null;
    cambios.push(dato);
  }
  if (cambios.length === 0) return null;
  const permitidas = contexto.filas;
  if (permitidas && !cambios.every((c) => permitidas.includes(c.fila))) return null;
  return cambios;
}

/**
 * Lee la respuesta a una tarjeta «Entendí»: `si`, `no` o `cambio` con las filas y los valores dichos. `null` si no
 * está seguro (la tarjeta se queda esperando el toque).
 */
export function leerConfirmacion(
  texto: string,
  contexto: ContextoConfirmacion = {},
): LecturaConfirmacion | null {
  const tokens = tokenizar(texto);
  if (tokens.t.length === 0) return null;
  const l = new Lector(tokens);
  let lectura: LecturaConfirmacion | null = null;
  if (soloPiezas(l, AFIRMA, CORTESIA)) lectura = { tipo: 'si' };
  else if (soloPiezas(l, NIEGA, CORTESIA)) lectura = { tipo: 'no' };
  else {
    const cambios = cambio(l, contexto);
    if (cambios) lectura = { tipo: 'cambio', cambios };
  }
  if (lectura === null) return null;
  const r = EsquemaLecturaConfirmacion.safeParse(lectura);
  return r.success ? r.data : null;
}
