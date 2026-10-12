/**
 * Analizadores de estados de cuenta en PDF (`docs/07-CAPTURA.md §8`, M15): como las plantillas de §3, pero sobre
 * el texto ya extraído del PDF en el teléfono. Un analizador por banco, declarativo (expresiones de JavaScript con
 * grupos nombrados), para poder agregar o corregir bancos sin tocar código.
 *
 * Regla 9: ningún error ni resultado lleva el texto del estado de cuenta fuera de los campos extraídos; los
 * mensajes de error solo nombran ids de analizador y de campo.
 */
import type { Centavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { conDia, diasDelMes, type PlainDate } from '../fecha';
import { parsearMonto } from './plantillas';

// ——— Formato del archivo de analizadores ———

/** Campos del encabezado. `periodo` usa los grupos `desde` y `hasta`; los demás, el grupo `v`. */
export const CAMPOS_ESTADO = [
  'ultimos4',
  'periodo',
  'corte',
  'limite',
  'limite_credito',
  'saldo_anterior',
  'saldo_corte',
  'pngi',
  'pago_minimo',
  'total_cargos',
  'total_abonos',
] as const;
export type CampoEstado = (typeof CAMPOS_ESTADO)[number];

/** Sin estos no se puede conciliar ni completar: el estado queda `incompleto`. */
const CAMPOS_REQUERIDOS: readonly CampoEstado[] = ['corte', 'saldo_corte'];

/** Una sección de renglones: de la línea que coincide con `inicio` (excluida) a la que coincide con `fin`. */
export interface SeccionAnalizador {
  readonly inicio: string;
  readonly fin?: string | undefined;
  /** Renglones de la sección que no son movimientos (encabezados de columna, pies de página). */
  readonly ignorar?: readonly string[] | undefined;
  /** Movimientos: `fecha`, `descripcion`, `monto` y opcional `abono`. MSI: `descripcion`, `original`, `pendiente`, `cuota`, `numero`, `plazo`. */
  readonly renglon: string;
}

/** Un analizador tal como viene en el archivo (`fixtures/pdf/analizadores.ejemplo.json`). */
export interface AnalizadorEstado {
  /** `banco.estado.vN` */
  readonly id: string;
  readonly banco: string;
  readonly nombre: string;
  /** Se prueba contra todo el texto; el primer analizador que coincide gana. */
  readonly reconocer: string;
  readonly campos: Partial<Record<CampoEstado, string>>;
  readonly movimientos: SeccionAnalizador;
  readonly msi?: SeccionAnalizador | undefined;
  /** Reconocer pagos y comisiones por la descripción; por omisión, `TIPOS_POR_OMISION`. */
  readonly tipos?: { readonly pago?: string | undefined; readonly comision?: string | undefined } | undefined;
  /** Por omisión `'imu'`. */
  readonly flags?: string | undefined;
}

interface SeccionCompilada {
  readonly inicio: RegExp;
  readonly fin: RegExp | null;
  readonly ignorar: readonly RegExp[];
  readonly renglon: RegExp;
}

export interface AnalizadorCompilado {
  readonly id: string;
  readonly banco: string;
  readonly nombre: string;
  readonly reconocer: RegExp;
  readonly campos: Partial<Record<CampoEstado, RegExp>>;
  readonly movimientos: SeccionCompilada;
  readonly msi: SeccionCompilada | null;
  readonly pago: RegExp;
  readonly comision: RegExp;
}

export interface CatalogoAnalizadores {
  readonly version: number | null;
  /** En el orden del archivo: el primero que reconoce el texto gana. */
  readonly analizadores: readonly AnalizadorCompilado[];
}

/**
 * Por omisión, sobre la descripción en mayúsculas y sin acentos (`normalizarParaTipo`): un abono que dice "pago" es un pago a la tarjeta, y un
 * cargo de intereses, comisiones o su IVA es un cargo financiero (`comisiones_intereses`).
 */
export const TIPOS_POR_OMISION = {
  pago: '\\b(SU PAGO|PAGO|PAGOS|ABONO A TARJETA)\\b',
  comision: '\\b(INTERES|INTERESES|COMISION|COMISIONES|IVA|ANUALIDAD)\\b',
} as const;

const FLAGS_POR_OMISION = 'imu';

function invalido(mensaje: string): ErrorDominio {
  return new ErrorDominio('analizadores_invalidos', mensaje);
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function texto(v: unknown): v is string {
  return typeof v === 'string' && v !== '';
}

function compilar(id: string, nombre: string, patron: unknown, flags: string): RegExp {
  if (!texto(patron)) throw invalido(`analizador ${id}: ${nombre} vacío`);
  try {
    return new RegExp(patron, flags);
  } catch {
    throw invalido(`analizador ${id}: ${nombre} no compila`);
  }
}

function exigirGrupos(id: string, nombre: string, re: RegExp, grupos: readonly string[]): void {
  // Una expresión con los grupos nombrados los declara en su fuente como `(?<nombre>`.
  for (const g of grupos) {
    if (!re.source.includes(`(?<${g}>`)) throw invalido(`analizador ${id}: ${nombre} sin el grupo ${g}`);
  }
}

function compilarSeccion(
  id: string,
  nombre: string,
  s: unknown,
  flags: string,
  grupos: readonly string[],
): SeccionCompilada {
  if (!esObjeto(s)) throw invalido(`analizador ${id}: falta la sección ${nombre}`);
  const ignorar = s['ignorar'];
  if (ignorar !== undefined && (!Array.isArray(ignorar) || !ignorar.every(texto))) {
    throw invalido(`analizador ${id}: ${nombre}.ignorar`);
  }
  const renglon = compilar(id, `${nombre}.renglon`, s['renglon'], flags);
  exigirGrupos(id, `${nombre}.renglon`, renglon, grupos);
  return {
    inicio: compilar(id, `${nombre}.inicio`, s['inicio'], flags),
    fin: s['fin'] === undefined ? null : compilar(id, `${nombre}.fin`, s['fin'], flags),
    ignorar: ((ignorar as string[] | undefined) ?? []).map((p, i) =>
      compilar(id, `${nombre}.ignorar[${i}]`, p, flags),
    ),
    renglon,
  };
}

/**
 * Valida un archivo de analizadores (`{version?, analizadores}`; `advertencia` se ignora) y compila sus
 * expresiones. Cualquier error invalida el archivo completo (`analizadores_invalidos`).
 */
export function compilarAnalizadores(archivo: unknown): CatalogoAnalizadores {
  if (!esObjeto(archivo)) throw invalido('el archivo de analizadores no es un objeto');
  const { version, analizadores } = archivo;
  if (version !== undefined && !Number.isSafeInteger(version)) throw invalido('version no es entera');
  if (!Array.isArray(analizadores)) throw invalido('falta la lista analizadores');
  const ids = new Set<string>();
  const compilados: AnalizadorCompilado[] = [];
  for (const a of analizadores as unknown[]) {
    if (!esObjeto(a) || !texto(a['id'])) throw invalido('analizador sin id');
    const id = a['id'];
    if (ids.has(id)) throw invalido(`analizador ${id} repetido`);
    ids.add(id);
    if (!texto(a['banco']) || !texto(a['nombre'])) throw invalido(`analizador ${id}: banco o nombre`);
    const flags = a['flags'] ?? FLAGS_POR_OMISION;
    if (typeof flags !== 'string') throw invalido(`analizador ${id}: flags`);
    // `g` y `y` hacen que `exec` dependa de `lastIndex`: el resultado dejaría de ser determinista.
    if (/[gy]/.test(flags)) throw invalido(`analizador ${id}: flags g/y no permitidas`);
    const camposCrudos = a['campos'];
    if (!esObjeto(camposCrudos)) throw invalido(`analizador ${id}: campos`);
    const campos: Partial<Record<CampoEstado, RegExp>> = {};
    for (const [nombre, patron] of Object.entries(camposCrudos)) {
      if (!CAMPOS_ESTADO.includes(nombre as CampoEstado)) throw invalido(`analizador ${id}: campo ${nombre}`);
      const re = compilar(id, `campos.${nombre}`, patron, flags);
      exigirGrupos(id, `campos.${nombre}`, re, nombre === 'periodo' ? ['desde', 'hasta'] : ['v']);
      campos[nombre as CampoEstado] = re;
    }
    for (const r of CAMPOS_REQUERIDOS)
      if (!campos[r]) throw invalido(`analizador ${id}: falta el campo ${r}`);
    const tipos = a['tipos'] ?? {};
    if (!esObjeto(tipos)) throw invalido(`analizador ${id}: tipos`);
    compilados.push({
      id,
      banco: a['banco'],
      nombre: a['nombre'],
      reconocer: compilar(id, 'reconocer', a['reconocer'], flags),
      campos,
      movimientos: compilarSeccion(id, 'movimientos', a['movimientos'], flags, [
        'fecha',
        'descripcion',
        'monto',
      ]),
      msi:
        a['msi'] === undefined
          ? null
          : compilarSeccion(id, 'msi', a['msi'], flags, [
              'descripcion',
              'original',
              'pendiente',
              'cuota',
              'numero',
              'plazo',
            ]),
      // Los tipos se prueban sobre la descripción normalizada (mayúsculas, sin acentos): siempre con `u`.
      pago: compilar(id, 'tipos.pago', tipos['pago'] ?? TIPOS_POR_OMISION.pago, 'u'),
      comision: compilar(id, 'tipos.comision', tipos['comision'] ?? TIPOS_POR_OMISION.comision, 'u'),
    });
  }
  return { version: (version as number | undefined) ?? null, analizadores: compilados };
}

// ——— Texto ———

/**
 * El texto de las páginas como lo leen los analizadores: NFC, finales de línea `\n`, cualquier espacio (también
 * el no separable) como un solo espacio, renglones recortados y sin renglones vacíos.
 */
export function normalizarTextoPdf(paginas: readonly string[]): string {
  return paginas
    .join('\n')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/gu, ' ').trim())
    .filter((l) => l !== '')
    .join('\n');
}

/** Con menos que esto de caracteres visibles por página, el PDF es una imagen (`02 §26`: escaneado). */
export const CARACTERES_MINIMOS_POR_PAGINA = 50;

/** `true` si el PDF no trae texto que leer: una foto o un escaneo (sin OCR). */
export function esPdfEscaneado(paginas: readonly string[]): boolean {
  if (paginas.length === 0) return true;
  const visibles = paginas.join('').replace(/\s/gu, '').length;
  return visibles < CARACTERES_MINIMOS_POR_PAGINA * paginas.length;
}

// ——— Montos y fechas ———

/**
 * Monto con signo de un estado de cuenta: `-$1,234.56`, `- $ 1,234.56`, `1,234.56 CR` y `(1,234.56)` son
 * negativos (abonos o saldo a favor). `null` si no es un monto.
 */
export function parsearMontoEstado(s: string): Centavos | null {
  let t = s.trim();
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1).trim();
  }
  if (/\s*CR$/i.test(t)) {
    negativo = true;
    t = t.replace(/\s*CR$/i, '');
  }
  if (t.startsWith('-')) {
    negativo = !negativo;
    t = t.slice(1);
  }
  try {
    const m = parsearMonto(t);
    return negativo && m !== 0 ? -m : m;
  } catch {
    return null;
  }
}

const MESES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  set: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

function fechaValida(anio: number, mes: number, dia: number): PlainDate | null {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return null;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  if (!Number.isInteger(dia) || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return conDia(anio, mes, dia);
}

/**
 * Fecha de un estado de cuenta: `11/09/2026`, `11-09-2026`, `11-sep-2026`, `11 SEP 2026`, `11 de septiembre de
 * 2026` y, sin año, `11 SEP` o `11/09`: el año sale de `ancla` (el corte); si con ese año queda después del
 * ancla, es del año anterior. `null` si no se entiende.
 */
export function parsearFechaEstado(s: string, ancla?: PlainDate | null): PlainDate | null {
  const t = s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
  let dia: number;
  let mes: number | undefined;
  let anio: number | null;
  let m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/.exec(t);
  if (m) {
    dia = Number(m[1]);
    mes = Number(m[2]);
    anio = m[3] ? Number(m[3]) : null;
  } else {
    m = /^(\d{1,2})(?:[\s/.-]+|\s+de\s+)([a-z]+)\.?(?:(?:[\s/.-]+|\s+de\s+)(\d{4}))?$/.exec(t);
    if (!m) return null;
    dia = Number(m[1]);
    mes = MESES[m[2] as string];
    anio = m[3] ? Number(m[3]) : null;
  }
  if (mes === undefined) return null;
  if (anio !== null) return fechaValida(anio, mes, dia);
  if (!ancla) return null;
  const anioAncla = Number(ancla.slice(0, 4));
  const conAncla = fechaValida(anioAncla, mes, dia);
  if (conAncla !== null && conAncla <= ancla) return conAncla;
  return fechaValida(anioAncla - 1, mes, dia);
}

// ——— Resultado de la lectura ———

/** `cargo` (compra), `comision` (intereses, comisiones e IVA), `pago` (a la tarjeta) o `abono` (devolución, bonificación). */
export type TipoMovimientoEstado = 'cargo' | 'comision' | 'pago' | 'abono';

export interface MovimientoEstado {
  /** Posición en el estado de cuenta (desde 0): identifica el renglón al volver a leerlo. */
  readonly indice: number;
  readonly fecha: PlainDate;
  readonly descripcion: string;
  /** Siempre positivo; el sentido lo da `tipo`. */
  readonly monto: Centavos;
  readonly tipo: TipoMovimientoEstado;
}

export interface MsiEstado {
  readonly descripcion: string;
  readonly montoOriginal: Centavos;
  readonly saldoPendiente: Centavos;
  /** Mensualidad de este periodo. */
  readonly cuota: Centavos;
  readonly cuotaNumero: number;
  readonly cuotasTotales: number;
}

export interface EstadoCuentaLeido {
  readonly analizador: string;
  readonly banco: string;
  readonly nombreBanco: string;
  readonly ultimos4: string | null;
  readonly periodo: { readonly desde: PlainDate; readonly hasta: PlainDate } | null;
  readonly corte: PlainDate;
  /** Fecha límite de pago. */
  readonly limite: PlainDate | null;
  readonly limiteCredito: Centavos | null;
  readonly saldoAnterior: Centavos | null;
  /** Lo que se debe al corte (negativo = saldo a favor). */
  readonly saldoCorte: Centavos;
  readonly pngi: Centavos | null;
  readonly pagoMinimo: Centavos | null;
  readonly totalCargos: Centavos | null;
  readonly totalAbonos: Centavos | null;
  readonly movimientos: readonly MovimientoEstado[];
  readonly msi: readonly MsiEstado[];
  /** Renglones de las secciones que no se pudieron leer (ni movimiento ni ignorados). */
  readonly renglonesSinLeer: number;
  /** Con totales impresos: ¿la suma de lo leído coincide? `null` si el estado no trae totales. */
  readonly cuadra: boolean | null;
}

/** Lo que impide usar un estado reconocido: un campo requerido o mal escrito, o la sección de movimientos. */
export type FaltaEstado = CampoEstado | 'movimientos';

export type LecturaEstado =
  | { readonly tipo: 'escaneado' }
  | { readonly tipo: 'no_reconocido' }
  | { readonly tipo: 'incompleto'; readonly analizador: string; readonly faltan: readonly FaltaEstado[] }
  | { readonly tipo: 'leido'; readonly estado: EstadoCuentaLeido };

const ES_ABONO = (t: TipoMovimientoEstado) => t === 'pago' || t === 'abono';

/**
 * Descripción para reconocer pagos y comisiones: mayúsculas, sin acentos y solo letras y números separados por un
 * espacio. No es E9.1: aquí "PAGO" importa (E9.1 la quita como palabra vacía).
 */
export function normalizarParaTipo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Signo de un movimiento sobre la deuda de la tarjeta: cargos suben, pagos y abonos bajan. */
export function deudaDeMovimiento(m: Pick<MovimientoEstado, 'monto' | 'tipo'>): Centavos {
  return ES_ABONO(m.tipo) ? -m.monto : m.monto;
}

function grupo(m: RegExpExecArray | null, nombre: string): string | null {
  const v = m?.groups?.[nombre];
  return v === undefined || v === '' ? null : v;
}

function renglonesDeSeccion(lineas: readonly string[], s: SeccionCompilada): string[] | null {
  const inicio = lineas.findIndex((l) => s.inicio.test(l));
  if (inicio < 0) return null;
  const resto = lineas.slice(inicio + 1);
  const fin = s.fin ? resto.findIndex((l) => (s.fin as RegExp).test(l)) : -1;
  return fin < 0 ? resto : resto.slice(0, fin);
}

/**
 * Lee el texto normalizado de un estado de cuenta con el primer analizador que lo reconoce. Los renglones de las
 * secciones que no son movimientos ni se ignoran se cuentan en `renglonesSinLeer` (la pantalla lo avisa: lo que no
 * se lee no se agrega).
 */
export function analizarEstadoCuenta(
  textoNormalizado: string,
  catalogo: CatalogoAnalizadores,
): LecturaEstado {
  const a = catalogo.analizadores.find((x) => x.reconocer.test(textoNormalizado));
  if (!a) return { tipo: 'no_reconocido' };
  const lineas = textoNormalizado.split('\n');

  const crudo = (c: CampoEstado, g = 'v') => grupo(a.campos[c]?.exec(textoNormalizado) ?? null, g);
  const faltan: FaltaEstado[] = [];
  const corte = parsearFechaEstado(crudo('corte') ?? '');
  if (!corte) faltan.push('corte');
  const monto = (c: CampoEstado): Centavos | null => {
    const v = crudo(c);
    if (v === null) return null;
    const n = parsearMontoEstado(v);
    if (n === null) faltan.push(c);
    return n;
  };
  const saldoCorte = monto('saldo_corte');
  if (saldoCorte === null && !faltan.includes('saldo_corte')) faltan.push('saldo_corte');
  const desdeCrudo = crudo('periodo', 'desde');
  const hastaCrudo = crudo('periodo', 'hasta');
  let periodo: EstadoCuentaLeido['periodo'] = null;
  if (desdeCrudo !== null || hastaCrudo !== null) {
    const hasta = parsearFechaEstado(hastaCrudo ?? '', corte);
    const desde = parsearFechaEstado(desdeCrudo ?? '', hasta ?? corte);
    if (desde && hasta && desde <= hasta) periodo = { desde, hasta };
    else faltan.push('periodo');
  }
  const limiteCrudo = crudo('limite');
  const limite = limiteCrudo === null ? null : parsearFechaEstado(limiteCrudo);
  if (limiteCrudo !== null && limite === null) faltan.push('limite');
  const absoluto = (v: Centavos | null) => (v === null ? null : Math.abs(v));
  const campos = {
    limiteCredito: absoluto(monto('limite_credito')),
    saldoAnterior: monto('saldo_anterior'),
    pngi: absoluto(monto('pngi')),
    pagoMinimo: absoluto(monto('pago_minimo')),
    totalCargos: absoluto(monto('total_cargos')),
    totalAbonos: absoluto(monto('total_abonos')),
  };
  const seccion = renglonesDeSeccion(lineas, a.movimientos);
  if (seccion === null) faltan.push('movimientos');
  if (faltan.length > 0 || corte === null || saldoCorte === null || seccion === null) {
    return { tipo: 'incompleto', analizador: a.id, faltan };
  }

  let sinLeer = 0;
  const movimientos: MovimientoEstado[] = [];
  for (const l of seccion) {
    if (a.movimientos.ignorar.some((re) => re.test(l))) continue;
    const m = a.movimientos.renglon.exec(l);
    const fecha = parsearFechaEstado(grupo(m, 'fecha') ?? '', periodo?.hasta ?? corte);
    const valor = parsearMontoEstado(grupo(m, 'monto') ?? '');
    const descripcion = grupo(m, 'descripcion')?.trim() ?? '';
    if (!m || !fecha || valor === null || valor === 0 || descripcion === '') {
      sinLeer++;
      continue;
    }
    const abono = valor < 0 || grupo(m, 'abono') !== null;
    const normal = normalizarParaTipo(descripcion);
    const tipo: TipoMovimientoEstado = abono
      ? a.pago.test(normal)
        ? 'pago'
        : 'abono'
      : a.comision.test(normal)
        ? 'comision'
        : 'cargo';
    movimientos.push({ indice: movimientos.length, fecha, descripcion, monto: Math.abs(valor), tipo });
  }

  const msi: MsiEstado[] = [];
  const renglonesMsi = a.msi ? renglonesDeSeccion(lineas, a.msi) : null;
  if (a.msi && renglonesMsi) {
    for (const l of renglonesMsi) {
      if (a.msi.ignorar.some((re) => re.test(l))) continue;
      const m = a.msi.renglon.exec(l);
      const valor = (g: string) => absoluto(parsearMontoEstado(grupo(m, g) ?? ''));
      const [original, pendiente, cuota] = [valor('original'), valor('pendiente'), valor('cuota')];
      const numero = Number(grupo(m, 'numero'));
      const plazo = Number(grupo(m, 'plazo'));
      const descripcion = grupo(m, 'descripcion')?.trim() ?? '';
      const enteros =
        Number.isSafeInteger(numero) && Number.isSafeInteger(plazo) && numero >= 1 && numero <= plazo;
      if (!m || original === null || pendiente === null || cuota === null || !enteros || descripcion === '') {
        sinLeer++;
        continue;
      }
      msi.push({
        descripcion,
        montoOriginal: original,
        saldoPendiente: pendiente,
        cuota,
        cuotaNumero: numero,
        cuotasTotales: plazo,
      });
    }
  }

  const cargos = movimientos.filter((m) => !ES_ABONO(m.tipo)).reduce((s, m) => s + m.monto, 0);
  const abonos = movimientos.filter((m) => ES_ABONO(m.tipo)).reduce((s, m) => s + m.monto, 0);
  const cuadra =
    campos.totalCargos === null && campos.totalAbonos === null
      ? null
      : (campos.totalCargos === null || campos.totalCargos === cargos) &&
        (campos.totalAbonos === null || campos.totalAbonos === abonos);
  const ultimos4 = crudo('ultimos4');
  return {
    tipo: 'leido',
    estado: {
      analizador: a.id,
      banco: a.banco,
      nombreBanco: a.nombre,
      ultimos4: ultimos4 !== null && /^\d{4}$/.test(ultimos4) ? ultimos4 : null,
      periodo,
      corte,
      limite,
      ...campos,
      saldoCorte,
      movimientos,
      msi,
      renglonesSinLeer: sinLeer,
      cuadra,
    },
  };
}

/** Del texto de las páginas (tal como lo extrajo el teléfono) a la lectura del estado de cuenta. */
export function leerEstadoCuentaPdf(
  paginas: readonly string[],
  catalogo: CatalogoAnalizadores,
): LecturaEstado {
  if (esPdfEscaneado(paginas)) return { tipo: 'escaneado' };
  return analizarEstadoCuenta(normalizarTextoPdf(paginas), catalogo);
}
