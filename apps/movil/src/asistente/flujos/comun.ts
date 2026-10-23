import { conDia, esFecha, partes, sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import { interpretarMonto, normalizarAlias } from '@cartera/nlu';
import type { Contexto } from '../../servicios/contexto';
import { obtenerHoy } from '../../servicios/hoy';
import type { ResultadoTexto } from '../../servicios/registrar';
import type { FilaEntendi, OpcionFilaEntendi } from '../../ui/entendi';
import { formatearCentavos } from '../../ui/formato';
import type { ChipRespuesta, Respuesta } from '../tipos';
import type { AccionesFlujo, OrigenFlujo } from './contrato';
import { lineaCambioDia } from './textos';

/** Piezas que comparten los flujos: leer respuestas, desenvolver el origen y decir cómo cambió el día. */

export type ErrorPaso = { readonly error: string };

/** El `ctx` del contrato es un `Contexto` de servicios. */
export function comoContexto(ctx: unknown): Contexto {
  return ctx as Contexto;
}

/** `origen` tal cual o envuelto en `{ desde, porVoz }`. */
export function desenvolver(origen: unknown): { desde: unknown; porVoz: boolean } {
  if (origen !== null && typeof origen === 'object' && 'desde' in origen) {
    const o = origen as OrigenFlujo;
    return { desde: o.desde ?? null, porVoz: o.porVoz === true };
  }
  return { desde: origen ?? null, porVoz: false };
}

/** El `ResultadoTexto` de `registrarTexto` si `desde` es de ese tipo. */
export function resultadoDe<R extends ResultadoTexto['resultado']>(
  desde: unknown,
  resultado: R,
): Extract<ResultadoTexto, { resultado: R }> | null {
  if (
    desde !== null &&
    typeof desde === 'object' &&
    (desde as { resultado?: unknown }).resultado === resultado
  ) {
    return desde as Extract<ResultadoTexto, { resultado: R }>;
  }
  return null;
}

/** Un campo de texto de `desde` (`{ tarjetaId }`, `{ cuentaId }`). */
export function campoDe(desde: unknown, campo: string): string | null {
  if (desde === null || typeof desde !== 'object') return null;
  const v = (desde as Record<string, unknown>)[campo];
  return typeof v === 'string' && v !== '' ? v : null;
}

// ——— Leer respuestas ———

export interface MontoLeido {
  readonly centavos: Centavos;
  readonly aproximado: boolean;
}

/** Cantidad contestada: el campo de monto, un chip con centavos o lo dictado («como trescientos»). */
export function leerMonto(r: Respuesta, admiteCero: boolean): MontoLeido | null {
  const valido = (c: number) => Number.isSafeInteger(c) && (c > 0 || (admiteCero && c === 0));
  switch (r.tipo) {
    case 'monto':
      return valido(r.centavos) ? { centavos: r.centavos, aproximado: r.aproximado } : null;
    case 'chip': {
      const n = Number(r.valor);
      return r.valor.trim() !== '' && valido(n) ? { centavos: n, aproximado: false } : null;
    }
    case 'texto': {
      const m = interpretarMonto(r.texto, { admiteCero });
      return m && valido(m.centavos) ? { centavos: m.centavos, aproximado: m.aproximado } : null;
    }
  }
}

const SI = new Set(['si', 'sip', 'claro', 'correcto', 'exacto', 'eso', 'va', 'dale', 'simon', 'ajam']);
const NO = new Set(['no', 'nop', 'nel', 'tampoco', 'todavia']);

/** «sí» / «no» al inicio de lo dicho; `null` si no se sabe. */
export function siONo(texto: string): boolean | null {
  const primera = normalizarAlias(texto).split(' ')[0] ?? '';
  if (SI.has(primera)) return true;
  if (NO.has(primera)) return false;
  return null;
}

/**
 * Chip contestado: tocado, o dicho con su etiqueta o su valor («cada quincena», «la Nu»). Si lo dicho cabe en una
 * sola opción (o una sola opción cabe en lo dicho), es esa; si no, `null`.
 */
export function elegir(r: Respuesta, opciones: readonly ChipRespuesta[]): string | null {
  if (r.tipo === 'chip') return opciones.some((o) => o.valor === r.valor) ? r.valor : null;
  if (r.tipo !== 'texto') return null;
  const dicho = normalizarAlias(r.texto);
  if (dicho === '') return null;
  const exacta = opciones.find(
    (o) => normalizarAlias(o.etiqueta) === dicho || normalizarAlias(o.valor) === dicho,
  );
  if (exacta) return exacta.valor;
  const parciales = opciones.filter((o) => {
    const e = normalizarAlias(o.etiqueta);
    return e !== '' && (` ${e} `.includes(` ${dicho} `) || ` ${dicho} `.includes(` ${e} `));
  });
  const [unica] = parciales;
  return parciales.length === 1 && unica ? unica.valor : null;
}

/** Elegir entre dos chips de sí/no (el primero es «sí»): tocado, dicho con su etiqueta o con «sí»/«no». */
export function elegirSiNo(r: Respuesta, si: ChipRespuesta, no: ChipRespuesta): string | null {
  const elegido = elegir(r, [si, no]);
  if (elegido !== null) return elegido;
  if (r.tipo !== 'texto') return null;
  const s = siONo(r.texto);
  return s === null ? null : s ? si.valor : no.valor;
}

/** Número entero dicho o escrito («10», «diez», «somos 10»); `null` fuera de `[min, max]`. */
export function leerEntero(r: Respuesta, min: number, max: number): number | null {
  let n: number | null = null;
  if (r.tipo === 'chip') n = Number(r.valor);
  else if (r.tipo === 'monto') n = r.centavos % 100 === 0 ? r.centavos / 100 : null;
  else {
    const digitos = /\d+/.exec(r.texto);
    n = digitos ? Number(digitos[0]) : enteroEnPalabras(r.texto);
  }
  return n !== null && Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** «éramos tres», «ocho personas» → 3, 8: el tramo de palabras que el intérprete lee como cifra entera. */
function enteroEnPalabras(texto: string): number | null {
  const palabras = texto.trim().split(/\s+/);
  for (let i = 0; i < palabras.length; i++) {
    for (let j = palabras.length; j > i; j--) {
      const m = interpretarMonto(palabras.slice(i, j).join(' '), { admiteCero: false });
      if (m) return m.centavos % 100 === 0 ? m.centavos / 100 : null;
    }
  }
  return null;
}

const MESES: Readonly<Record<string, number>> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/**
 * Fecha dicha o escrita: `YYYY-MM-DD`, «hoy», «mañana», «16/10», «16/10/2026», «el 15» (de este mes) o «15 de
 * noviembre» (de este año). `null` si no es clara (fechas civiles, regla 6).
 */
export function leerFecha(texto: string, hoy: PlainDate): PlainDate | null {
  const t = texto.trim();
  if (esFecha(t)) return t;
  const n = normalizarAlias(t);
  if (n === 'hoy') return hoy;
  if (n === 'manana') return sumarDias(hoy, 1);
  if (n === 'pasado manana') return sumarDias(hoy, 2);
  const { anio, mes } = partes(hoy);
  const barras = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (barras) {
    const d = Number(barras[1]);
    const m = Number(barras[2]);
    const a = barras[3] === undefined ? anio : Number(barras[3].length === 2 ? `20${barras[3]}` : barras[3]);
    const f = `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return esFecha(f) ? f : null;
  }
  // `normalizarAlias` ya quitó «el» y «de»: «el 15 de noviembre» → «15 noviembre».
  const conMes = /^(\d{1,2}) ([a-z]+)$/.exec(n);
  if (conMes) {
    const m = MESES[conMes[2] ?? ''];
    const d = Number(conMes[1]);
    if (m === undefined || d < 1 || d > 31) return null;
    return conDia(anio, m, d);
  }
  const dia = /^(\d{1,2})$/.exec(n);
  if (dia) {
    const d = Number(dia[1]);
    return d >= 1 && d <= 31 ? conDia(anio, mes, d) : null;
  }
  return null;
}

// ——— «Entendí» ———

export function opcion(valor: string, etiqueta: string): OpcionFilaEntendi {
  return { valor, etiqueta };
}

/**
 * Fila tocable: con `actualizar` y al menos dos opciones, tocarla muestra los chips y elegir uno arma el estado
 * nuevo con `cambiar` (o lo ignora si devuelve `null`). Sin `actualizar`, la fila solo se lee.
 */
export function filaTocable<E>(
  base: Pick<FilaEntendi, 'clave' | 'etiqueta' | 'valor'>,
  opciones: readonly OpcionFilaEntendi[],
  acciones: AccionesFlujo<E>,
  cambiar: (valor: string) => E | null,
): FilaEntendi {
  const actualizar = acciones.actualizar;
  if (!actualizar || opciones.length < 2) return base;
  return {
    ...base,
    opciones,
    alCambiar: (valor) => {
      const nuevo = cambiar(valor);
      if (nuevo !== null) actualizar(nuevo);
    },
  };
}

// ——— Al guardar ———

/** La cifra de «Hoy puedes gastar» como la ve la persona (pesos enteros; nada sin ingreso). */
export function cifraHoy(ctx: Contexto): string | null {
  try {
    const v = obtenerHoy(ctx);
    if (v.estado === 'sin_ingreso') return null;
    return formatearCentavos(v.estado === 'libre_negativo' ? 0 : v.hoyPuedesCentavos, 'pesos');
  } catch {
    // Sin la cifra no se dice nada (y nada va a logs, regla 9).
    return null;
  }
}

/** Escribe con `escribir` y dice si la cifra de Hoy cambió («Tu día pasa de $214 a $187.»). */
export function conCambioDia<T>(ctx: Contexto, escribir: () => T): { resultado: T; cambioDia?: string } {
  const antes = cifraHoy(ctx);
  const resultado = escribir();
  const despues = cifraHoy(ctx);
  return antes !== null && despues !== null && antes !== despues
    ? { resultado, cambioDia: lineaCambioDia(antes, despues) }
    : { resultado };
}

/** Primera letra en mayúscula («cena» → «Cena»). */
export function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
