/**
 * GASTO del nivel 0 (docs/06-NLU.md §9): una o varias compras en una frase, con fecha relativa al inicio o al final,
 * método de pago propio o compartido ("todo en efectivo") y comercio con mayúscula ("en el Oxxo").
 */
import type { Centavos } from '@cartera/core';
import type { Interpretacion, Movimiento, RefCuenta } from '../esquema';
import { leerDesc, esComercio, type Desc } from './desc';
import type { Entorno } from './entorno';
import { leerFechaRegistro } from './fechas';
import { Lector } from './lector';
import { leerMonto } from './montos';
import { tieneCifra } from './sin-nube';
import { ARTICULOS, SEP, type Tokens, recortar } from './tokens';

const MAX_MOVIMIENTOS = 10;

export const VERBOS: readonly (readonly string[])[] = [
  ['me', 'compre'],
  ['compre'],
  ['me', 'eche'],
  ['me', 'gaste'],
  ['gaste'],
  ['pague'],
  ['me', 'comi'],
  ['comi'],
  ['cene'],
  ['desayune'],
  ['almorce'],
  ['me', 'tome'],
  ['tome'],
  ['cargue'],
  ['coopere'],
  ['registra'],
  ['anota'],
  ['apunta'],
];
/** "cooperé con 150 para el pastel": solo tras "cooperé" el "con" va antes del monto ("pagué con 500" no dice cuánto costó). */
const VERBOS_CON_MONTO: readonly string[] = ['coopere'];
/** Tras "VERBO MONTO": "gasté 450 de gasolina", "pagué 300 por la consulta", "cooperé con 150 para el pastel". */
const CONECTORES_MONTO = ['de', 'del', 'en', 'por'];
const CONECTORES_MONTO_CON_VERBO = [...CONECTORES_MONTO, 'para'];
const VERBOS_MONTO_SUELTO: readonly string[] = ['registra', 'anota', 'apunta'];
const VERBOS_COSTO: readonly (readonly string[])[] = [['me', 'costo'], ['me', 'salio'], ['costo'], ['salio']];
const VERBOS_GASOLINA: readonly (readonly string[])[] = [
  ['le', 'puse'],
  ['le', 'eche'],
  ['le', 'cargue'],
];
const GASOLINA = new Set(['gasolina', 'diesel', 'magna', 'premium']);
const VEHICULOS: readonly (readonly string[])[] = [
  ['al', 'coche'],
  ['al', 'carro'],
  ['al', 'auto'],
  ['a', 'la', 'camioneta'],
  ['a', 'la', 'moto'],
  ['a', 'la', 'troca'],
];
/** Entre la DESC y el MONTO: "la luz, fueron 410", "tacos de 80". */
const ANTES_DEL_MONTO = new Set([SEP, 'de', 'por', 'en', 'fueron', 'fue', 'costo', 'salio']);
const TODO = new Set(['todo', 'todos', 'ambos']);

interface Parcial {
  monto: Centavos;
  aproximado: boolean;
  desc?: Desc;
  origen?: RefCuenta;
  conVerbo: boolean;
}

/** Dónde empieza el METODO final de `[inicio, fin)`, o `fin` si no hay. Con `todo`, admite "todo en efectivo". */
function inicioMetodoFinal(
  tokens: Tokens,
  inicio: number,
  fin: number,
  env: Entorno,
  admitirTodo: boolean,
): { desde: number; origen: RefCuenta; todo: boolean } | null {
  const l = new Lector(tokens);
  for (let p = Math.max(inicio + 1, fin - 8); p < fin; p++) {
    l.volver(p);
    l.sep();
    const todo = admitirTodo && (l.palabra(...TODO) || l.secuencia('los', 'dos'));
    const origen = env.metodo(l);
    if (origen && l.pos === fin) return { desde: p, origen, todo };
  }
  return null;
}

/** Dónde empieza "en [art] COMERCIO" al final de `[inicio, fin)`, o `fin`. */
function inicioComercioFinal(tokens: Tokens, inicio: number, fin: number, env: Entorno): number {
  for (const n of [4, 3, 2]) {
    const p = fin - n;
    if (p <= inicio || tokens.t[p] !== 'en') continue;
    const conArticulo = ARTICULOS.has(tokens.t[p + 1] ?? '');
    const desdeComercio = p + 1 + (conArticulo ? 1 : 0);
    if (desdeComercio < fin && esComercio(tokens, desdeComercio, fin, env)) return p;
  }
  return fin;
}

function verbo(l: Lector): number {
  const encontrado = VERBOS.find((v) => v.every((p, k) => l.ver(k) === p));
  if (!encontrado) return 0;
  l.pos += encontrado.length;
  return encontrado.length;
}

/**
 * Varias cosas con un solo monto dicho antes ("gasté 90 en estampitas y un refresco"): 2 o 3 DESC separadas por "y"
 * o coma. Es un solo gasto por el total (06 §3.1); categoría solo si todas son de la misma.
 */
function listaDeDescs(
  tokens: Tokens,
  inicio: number,
  fin: number,
  env: Entorno,
  opciones: { conocida: boolean; recibo?: boolean },
): Desc | null {
  const tramos: [number, number][] = [];
  let desde = inicio;
  for (let i = inicio; i <= fin; i++) {
    const p = tokens.t[i];
    if (i < fin && p !== 'y' && p !== SEP) continue;
    if (i === desde) return null;
    tramos.push([desde, i]);
    desde = i + 1;
    if (p === SEP && tokens.t[desde] === 'y') {
      desde++;
      i++;
    }
  }
  if (tramos.length < 2 || tramos.length > 3) return null;
  const descs: Desc[] = [];
  for (const [a, b] of tramos) {
    const desc = leerDesc(tokens, a, b, env, opciones);
    if (!desc || desc.espacio) return null;
    descs.push(desc);
  }
  const [primera] = descs;
  const categoria = primera?.categoria;
  const nombres = descs.map((d) => d.descripcion);
  const descripcion = `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1] ?? ''}`;
  return categoria && descs.every((d) => d.categoria === categoria)
    ? { descripcion, categoria }
    : { descripcion };
}

/** Primera posición `p` en `[desde, fin)` tal que un MONTO leído en `p` termina exactamente en `fin`. */
function montoAlFinal(
  tokens: Tokens,
  desde: number,
  fin: number,
): { pos: number; monto: Centavos; aproximado: boolean } | null {
  const l = new Lector(tokens);
  for (let p = desde; p < fin; p++) {
    l.volver(p);
    const lectura = leerMonto(l);
    if (lectura && l.pos === fin && lectura.monto > 0) return { pos: p, ...lectura };
  }
  return null;
}

class GastoSimple {
  constructor(
    private readonly tokens: Tokens,
    private readonly env: Entorno,
    private readonly heredaVerbo: boolean,
  ) {}

  leer(): Parcial | null {
    const t = this.tokens.t;
    let fin = t.length;
    const metodo = inicioMetodoFinal(this.tokens, 0, fin, this.env, false);
    if (metodo) fin = metodo.desde;
    const inicioComercio = inicioComercioFinal(this.tokens, 0, fin, this.env);
    const comercio = inicioComercio < fin ? this.tokens.o.slice(inicioComercio, fin).join(' ') : undefined;
    fin = inicioComercio;
    const formas = [
      () => this.descYMonto(fin),
      () => this.montoYDesc(fin),
      () => this.costo(fin),
      () => this.montoSuelto(fin),
      () => this.gasolina(fin),
    ];
    for (const forma of formas) {
      const parcial = forma();
      if (!parcial) continue;
      if (comercio !== undefined && parcial.desc)
        parcial.desc.descripcion = `${parcial.desc.descripcion} ${comercio}`;
      if (comercio !== undefined && !parcial.desc) return null;
      return metodo ? { ...parcial, origen: metodo.origen } : parcial;
    }
    return null;
  }

  /**
   * VERBO [yo] [en|a [art]] DESC [,] [de|por|en] [fueron|fue|costó|salió] MONTO
   * DESC_CONOCIDA [,] [de|por|en] [fueron|fue] MONTO
   */
  private descYMonto(fin: number): Parcial | null {
    const l = new Lector(this.tokens);
    const largoVerbo = verbo(l);
    const conVerbo = largoVerbo > 0 || this.heredaVerbo;
    if (largoVerbo > 0) {
      l.palabra('yo');
      if (l.palabra('en', 'a')) l.palabra(...ARTICULOS);
    }
    const inicioDesc = l.pos;
    const monto = montoAlFinal(this.tokens, inicioDesc + 1, fin);
    if (!monto) return null;
    let finDesc = monto.pos;
    while (finDesc > inicioDesc && ANTES_DEL_MONTO.has(this.tokens.t[finDesc - 1] ?? '')) finDesc--;
    if (finDesc <= inicioDesc) return null;
    // La coma solo antes del monto, no en medio de la DESC.
    const desc = leerDesc(this.tokens, inicioDesc, finDesc, this.env, { conocida: !conVerbo });
    return desc ? { monto: monto.monto, aproximado: monto.aproximado, desc, conVerbo } : null;
  }

  /**
   * VERBO [con] MONTO (de|en|por|para) [art] DESC          ("con" solo tras "cooperé")
   * MONTO (de|del|en|por) [art] DESC_CONOCIDA
   * Y con varias cosas: "gasté 90 en estampitas y un refresco" (un gasto por el total).
   */
  private montoYDesc(fin: number): Parcial | null {
    const l = new Lector(this.tokens);
    const largoVerbo = verbo(l);
    const conVerbo = largoVerbo > 0 || this.heredaVerbo;
    if (largoVerbo > 0 && VERBOS_CON_MONTO.includes(this.tokens.t[l.pos - 1] ?? '')) l.palabra('con');
    const lectura = leerMonto(l);
    if (!lectura || lectura.monto <= 0 || l.pos >= fin) return null;
    const conector = l.ver();
    const conectores = conVerbo ? CONECTORES_MONTO_CON_VERBO : CONECTORES_MONTO;
    if (conector === undefined || !conectores.includes(conector)) return null;
    l.pos++;
    if (l.pos >= fin) return null;
    const opciones = { conocida: !conVerbo, recibo: conector === 'de' };
    const desc =
      leerDesc(this.tokens, l.pos, fin, this.env, opciones) ??
      listaDeDescs(this.tokens, l.pos, fin, this.env, opciones);
    return desc ? { monto: lectura.monto, aproximado: lectura.aproximado, desc, conVerbo } : null;
  }

  /** (me costó | me salió) [en] MONTO [art] DESC */
  private costo(fin: number): Parcial | null {
    const l = new Lector(this.tokens);
    if (!l.alguna(...VERBOS_COSTO)) return null;
    l.palabra('en');
    const lectura = leerMonto(l);
    if (!lectura || lectura.monto <= 0 || l.pos >= fin) return null;
    const desc = leerDesc(this.tokens, l.pos, fin, this.env, { conocida: false });
    return desc ? { monto: lectura.monto, aproximado: lectura.aproximado, desc, conVerbo: true } : null;
  }

  /** (registra | anota | apunta | cooperé [con]) MONTO: monto suelto, gasto sin categoría. */
  private montoSuelto(fin: number): Parcial | null {
    const l = new Lector(this.tokens);
    if (l.palabra(...VERBOS_CON_MONTO)) l.palabra('con');
    else if (!l.palabra(...VERBOS_MONTO_SUELTO)) return null;
    const lectura = leerMonto(l);
    if (!lectura || lectura.monto <= 0 || l.pos !== fin) return null;
    return { monto: lectura.monto, aproximado: lectura.aproximado, conVerbo: true };
  }

  /** le (puse | eché | cargué) MONTO de GASOLINA [al coche] */
  private gasolina(fin: number): Parcial | null {
    const l = new Lector(this.tokens);
    if (!l.alguna(...VERBOS_GASOLINA)) return null;
    const lectura = leerMonto(l);
    if (!lectura || lectura.monto <= 0 || !l.palabra('de')) return null;
    const inicioDesc = l.pos;
    const combustible = l.ver();
    if (combustible === undefined || !GASOLINA.has(combustible)) return null;
    l.pos++;
    const descripcion = l.original(inicioDesc, l.pos);
    l.alguna(...VEHICULOS);
    if (l.pos !== fin) return null;
    return {
      monto: lectura.monto,
      aproximado: lectura.aproximado,
      desc: { descripcion, categoria: 'gasolina' },
      conVerbo: true,
    };
  }
}

/** Parte una lista de gastos en SEP o "y" de izquierda a derecha; cada parte debe ser un GASTO completo. */
function partes(tokens: Tokens, env: Entorno, heredaVerbo: boolean, profundidad: number): Parcial[] | null {
  if (tokens.t.length === 0 || profundidad > MAX_MOVIMIENTOS) return null;
  const entero = new GastoSimple(tokens, env, heredaVerbo).leer();
  if (entero) return [entero];
  for (let i = 1; i < tokens.t.length - 1; i++) {
    if (tokens.t[i] !== SEP && tokens.t[i] !== 'y') continue;
    const primera = new GastoSimple(recortar(tokens, 0, i), env, heredaVerbo).leer();
    if (!primera) continue;
    let siguiente = i + 1;
    if (tokens.t[i] === SEP && tokens.t[siguiente] === 'y') siguiente++;
    const resto = partes(
      recortar(tokens, siguiente, tokens.t.length),
      env,
      heredaVerbo || primera.conVerbo,
      profundidad + 1,
    );
    if (resto) return [primera, ...resto];
  }
  return null;
}

/** Quita la fecha relativa al inicio o al final de la frase (una sola). */
function fechaYCuerpo(tokens: Tokens, env: Entorno): { fecha: string; cuerpo: Tokens } | null {
  const l = new Lector(tokens);
  const prefijo = leerFechaRegistro(l, env.hoy);
  if (prefijo !== null) {
    l.sep();
    return { fecha: prefijo, cuerpo: recortar(tokens, l.pos, tokens.t.length) };
  }
  for (let p = tokens.t.length - 1; p >= Math.max(1, tokens.t.length - 4); p--) {
    l.volver(p);
    const sufijo = leerFechaRegistro(l, env.hoy);
    if (sufijo !== null && l.fin) {
      const fin = tokens.t[p - 1] === SEP ? p - 1 : p;
      return { fecha: sufijo, cuerpo: recortar(tokens, 0, fin) };
    }
  }
  return { fecha: env.hoy, cuerpo: tokens };
}

/** Un solo gasto (sin fecha ni método compartido) en todos los `tokens`, o `null`. Lo usa DIVIDIDA ("…me deben su parte"). */
export function leerGastoSimple(
  tokens: Tokens,
  env: Entorno,
): { monto: Centavos; aproximado: boolean; desc?: Desc; origen?: RefCuenta } | null {
  const parcial = new GastoSimple(tokens, env, false).leer();
  return parcial?.conVerbo ? parcial : null;
}

const DEFINIDO: Readonly<Record<string, string>> = {
  un: 'el',
  una: 'la',
  unos: 'los',
  unas: 'las',
  el: 'el',
  la: 'la',
  los: 'los',
  las: 'las',
};

/**
 * Una lista de gastos donde a una parte le falta su cifra: "unos tacos de 80 y una coca" (X06). No se registra nada
 * a medias: se pregunta cuánto costó lo que falta (06 §3.1 Montos). Solo si la primera parte trae su monto: en "unos
 * tenis y una playera de 1,200" la cifra puede ser el total, y eso lo decide la nube.
 */
export function gastoSinMonto(tokens: Tokens, env: Entorno): Interpretacion | null {
  const conFecha = fechaYCuerpo(tokens, env);
  if (!conFecha) return null;
  let cuerpo = conFecha.cuerpo;
  const metodo = inicioMetodoFinal(cuerpo, 0, cuerpo.t.length, env, true);
  if (metodo) cuerpo = recortar(cuerpo, 0, metodo.desde);
  const tramos: [number, number][] = [];
  let desde = 0;
  for (let i = 0; i <= cuerpo.t.length; i++) {
    const p = cuerpo.t[i];
    if (i < cuerpo.t.length && p !== 'y' && p !== SEP) continue;
    if (i === desde) {
      if (p === 'y' && cuerpo.t[i - 1] === SEP) {
        desde = i + 1;
        continue;
      }
      return null;
    }
    tramos.push([desde, i]);
    desde = i + 1;
  }
  if (tramos.length < 2 || tramos.length > MAX_MOVIMIENTOS) return null;
  let heredaVerbo = false;
  const faltan: { nombre: string; plural: boolean }[] = [];
  for (const [indice, [a, b]] of tramos.entries()) {
    const parte = recortar(cuerpo, a, b);
    const leido = new GastoSimple(parte, env, heredaVerbo).leer();
    if (leido) {
      heredaVerbo ||= leido.conVerbo;
      continue;
    }
    if (indice === 0 || tieneCifra(parte.t)) return null;
    const l = new Lector(parte);
    const conVerbo = verbo(l) > 0;
    const desc = leerDesc(parte, l.pos, parte.t.length, env, { conocida: !(conVerbo || heredaVerbo) });
    if (!desc || desc.espacio) return null;
    heredaVerbo ||= conVerbo;
    const articulo = DEFINIDO[parte.t[l.pos] ?? ''];
    faltan.push({
      nombre: articulo ? `${articulo} ${desc.descripcion}` : desc.descripcion,
      plural: articulo === 'los' || articulo === 'las' || (!articulo && /s$/.test(desc.descripcion)),
    });
  }
  const [unico] = faltan;
  if (!unico) return null;
  const nombres = faltan.map((f) => f.nombre);
  const lista = `${nombres.slice(0, -1).join(', ')}${nombres.length > 1 ? ' y ' : ''}${nombres[nombres.length - 1]}`;
  const plural = faltan.length > 1 || unico.plural;
  const pregunta = `¿Cuánto ${plural ? 'costaron' : 'costó'} ${lista}?`;
  // La pregunta del esquema mide a lo más 120 caracteres.
  return {
    intencion: 'aclarar',
    motivo: 'monto_faltante',
    pregunta: pregunta.length <= 120 ? pregunta : '¿Cuánto costó cada cosa?',
  };
}

/** GASTO := [FECHA] PARTE (("y" | ",") PARTE)* [, [todo] METODO] [FECHA] */
export function gastos(tokens: Tokens, env: Entorno): Interpretacion | null {
  const conFecha = fechaYCuerpo(tokens, env);
  if (!conFecha) return null;
  let cuerpo = conFecha.cuerpo;
  let compartido: RefCuenta | undefined;
  let todo = false;
  const metodo = inicioMetodoFinal(cuerpo, 0, cuerpo.t.length, env, true);
  if (metodo) {
    compartido = metodo.origen;
    todo = metodo.todo;
    cuerpo = recortar(cuerpo, 0, metodo.desde);
  }
  const lista = partes(cuerpo, env, false, 1);
  if (!lista || lista.length > MAX_MOVIMIENTOS) return null;
  if (todo && lista.some((p) => p.origen)) return null;
  const movimientos: Movimiento[] = lista.map((p) => ({
    tipo: 'gasto',
    monto: p.monto,
    fecha: conFecha.fecha,
    ...(p.desc ? { descripcion: p.desc.descripcion } : {}),
    ...(p.desc?.categoria ? { categoria: p.desc.categoria } : {}),
    ...(p.desc?.espacio ? { espacio: p.desc.espacio } : {}),
    origen: p.origen ?? compartido ?? { tipo: 'desconocido' },
    ...(p.aproximado ? { aproximado: true } : {}),
  }));
  return { intencion: 'registrar', movimientos };
}
