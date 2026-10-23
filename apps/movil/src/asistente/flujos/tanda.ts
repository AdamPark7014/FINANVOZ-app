import { ErrorDominio, type Centavos, type PlainDate, type Regla } from '@cartera/core';
import { interpretarPaso, type ContextoPaso, type LecturaDe } from '@cartera/nlu';
import { contextoInterprete } from '../../servicios/registrar';
import {
  crearTanda,
  fechasPrimeraRonda,
  FRECUENCIAS_TANDA,
  frecuenciaDeRegla,
  proponerTanda,
  reglaDeFrecuencia,
  type EntradaTanda,
  type FrecuenciaTanda,
  type PropuestaTanda,
} from '../../servicios/tandas';
import type { FilaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, PasoFlujo, Respuesta } from '../tipos';
import {
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  filaTocable,
  leerEntero,
  leerFecha,
  leerMonto,
  opcion,
  resultadoDe,
  type ErrorPaso,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Tanda (Ola 7 §6): desde `interpretarPaso('tanda', frase)` o `tanda_por_crear` de `registrarTexto` («entré a una
 * tanda de 500 cada quincena, somos 10 y me toca el cuarto»). Pregunta lo que falte (cuánto, cada cuándo, cuántos,
 * turno, primera fecha con chips hoy/15/último) → «Entendí» con el calendario de E11 (`proponerTanda`) →
 * `crearTanda`.
 */

export interface EstadoTanda {
  readonly hoy: PlainDate;
  readonly contexto: ContextoPaso;
  /** Chips de la primera ronda: hoy, el próximo 15 y el último del mes. */
  readonly cercanas: readonly PlainDate[];
  readonly nombre: string | null;
  readonly aportacion: Centavos | null;
  readonly aproximado: boolean;
  readonly frecuencia: FrecuenciaTanda | null;
  readonly participantes: number | null;
  readonly turno: number | null;
  readonly inicio: PlainDate | null;
  /** La regla que ya traía la propuesta (TK01); se rehace si cambian la frecuencia o la primera fecha. */
  readonly regla: Regla | null;
  /** Lo que corrigió la persona en una tanda que ya empezó (sin esto, lo que propone E11). */
  readonly aportacionesHechas: number | null;
  readonly yaCobraste: boolean | null;
}

type LecturaTanda = LecturaDe<'tanda'>;

function vacio(hoy: PlainDate, contexto: ContextoPaso): EstadoTanda {
  return {
    hoy,
    contexto,
    cercanas: fechasPrimeraRonda(hoy),
    nombre: null,
    aportacion: null,
    aproximado: false,
    frecuencia: null,
    participantes: null,
    turno: null,
    inicio: null,
    regla: null,
    aportacionesHechas: null,
    yaCobraste: null,
  };
}

function leer(e: EstadoTanda, texto: string): LecturaTanda | null {
  const l = interpretarPaso('tanda', texto, e.contexto);
  return l?.paso === 'tanda' ? l : null;
}

function conLectura(e: EstadoTanda, l: LecturaTanda): EstadoTanda | ErrorPaso {
  const n = l.participantes ?? e.participantes;
  const k = l.turno ?? e.turno;
  if (n !== null && k !== null && k > n) return { error: T.errorTurno(n) };
  return {
    ...e,
    ...(l.aportacion ? { aportacion: l.aportacion.monto, aproximado: l.aportacion.aproximado } : {}),
    ...(l.frecuencia ? { frecuencia: l.frecuencia, regla: null } : {}),
    ...(l.participantes !== undefined ? { participantes: l.participantes, aportacionesHechas: null } : {}),
    ...(l.turno !== undefined ? { turno: l.turno, yaCobraste: null } : {}),
  };
}

function conPropuesta(e: EstadoTanda, p: PropuestaTanda): EstadoTanda {
  return {
    ...e,
    nombre: p.nombre,
    aportacion: p.aportacion,
    frecuencia: frecuenciaDeRegla(p.regla),
    participantes: p.participantes,
    turno: p.turno,
    inicio: p.inicio,
    regla: p.regla,
  };
}

const esLecturaTanda = (x: unknown): x is LecturaTanda =>
  x !== null && typeof x === 'object' && (x as { paso?: unknown }).paso === 'tanda';

const CHIPS_FRECUENCIA: readonly ChipRespuesta[] = FRECUENCIAS_TANDA.map((f) => ({
  valor: f,
  etiqueta: T.FRECUENCIAS_TANDA_TEXTO[f],
}));

const chipsFecha = (e: EstadoTanda): ChipRespuesta[] =>
  e.cercanas.map((f) => ({ valor: f, etiqueta: T.etiquetaChipFecha(f, e.hoy) }));

/**
 * Lo dicho primero se intenta como frase de tanda («somos 10 y me toca el cuarto»); si no, con el principio que le
 * falta («cuarto» → «me toca el cuarto»). `null` si no trae el dato del paso.
 */
function porLectura(
  e: EstadoTanda,
  r: Respuesta,
  prefijos: readonly string[],
  trae: (l: LecturaTanda) => boolean,
): EstadoTanda | ErrorPaso | null {
  if (r.tipo !== 'texto') return null;
  for (const texto of [r.texto, ...prefijos.map((p) => `${p} ${r.texto}`)]) {
    const l = leer(e, texto);
    if (l && trae(l)) return conLectura(e, l);
  }
  return null;
}

/** «cada quincena», «semanal», «cada 14 días», «mensual» → frecuencia. */
function frecuenciaDicha(texto: string): FrecuenciaTanda | null {
  const t = texto.toLowerCase();
  if (/14|catorce|catorcenal/.test(t)) return 'catorcenal';
  if (/quincen/.test(t)) return 'quincenal';
  if (/seman/.test(t)) return 'semanal';
  if (/\bmes\b|mensual/.test(t)) return 'mensual';
  return null;
}

const pasos: readonly PasoFlujo<EstadoTanda>[] = [
  {
    id: 'aportacion',
    pregunta: () => T.PREGUNTA_APORTACION,
    campo: 'monto',
    omitirSi: (e) => e.aportacion !== null,
    aplicar: (e, r) => {
      const l = porLectura(e, r, [], (x) => x.aportacion !== undefined);
      if (l) return l;
      const m = leerMonto(r, false);
      return m === null
        ? { error: T.ERROR_MONTO }
        : { ...e, aportacion: m.centavos, aproximado: m.aproximado };
    },
  },
  {
    id: 'frecuencia',
    pregunta: () => T.PREGUNTA_FRECUENCIA,
    chips: () => CHIPS_FRECUENCIA,
    omitirSi: (e) => e.frecuencia !== null,
    aplicar: (e, r) => {
      const v = elegir(r, CHIPS_FRECUENCIA) ?? (r.tipo === 'texto' ? frecuenciaDicha(r.texto) : null);
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, frecuencia: v as FrecuenciaTanda, regla: null };
    },
  },
  {
    id: 'participantes',
    pregunta: () => T.PREGUNTA_PARTICIPANTES,
    ayuda: () => T.AYUDA_PARTICIPANTES,
    campo: 'texto',
    omitirSi: (e) => e.participantes !== null,
    aplicar: (e, r) => {
      const l = porLectura(e, r, ['somos'], (x) => x.participantes !== undefined);
      if (l) return l;
      const n = leerEntero(r, 2, 50);
      if (n === null) return { error: T.ERROR_PARTICIPANTES };
      if (e.turno !== null && e.turno > n) return { error: T.errorTurno(n) };
      return { ...e, participantes: n, aportacionesHechas: null };
    },
  },
  {
    id: 'turno',
    pregunta: () => T.PREGUNTA_TURNO,
    ayuda: (e) => T.ayudaTurno(e.participantes ?? 50),
    campo: 'texto',
    chips: (e) =>
      e.participantes !== null && e.participantes <= 6
        ? Array.from({ length: e.participantes }, (_, i) => ({
            valor: String(i + 1),
            etiqueta: T.etiquetaChipTurno(i + 1),
          }))
        : [],
    omitirSi: (e) => e.turno !== null,
    aplicar: (e, r) => {
      const max = e.participantes ?? 50;
      const l = porLectura(e, r, ['me toca', 'me toca el'], (x) => x.turno !== undefined);
      if (l) return l;
      const k = leerEntero(r, 1, max);
      return k === null ? { error: T.errorTurno(max) } : { ...e, turno: k, yaCobraste: null };
    },
  },
  {
    id: 'inicio',
    pregunta: () => T.PREGUNTA_INICIO,
    campo: 'fecha',
    chips: chipsFecha,
    omitirSi: (e) => e.inicio !== null,
    aplicar: (e, r) => {
      const f =
        r.tipo === 'chip'
          ? elegir(r, chipsFecha(e))
          : r.tipo === 'texto'
            ? (elegir(r, chipsFecha(e)) ?? leerFecha(r.texto, e.hoy))
            : null;
      return f === null
        ? { error: T.ERROR_FECHA }
        : { ...e, inicio: f, regla: null, aportacionesHechas: null, yaCobraste: null };
    },
  },
];

/** La entrada de `proponerTanda` / `crearTanda`; `tanda_invalida` si todavía falta algo. */
export function entradaTanda(e: EstadoTanda): EntradaTanda {
  const { aportacion, frecuencia, participantes, turno, inicio } = e;
  if (
    aportacion === null ||
    frecuencia === null ||
    participantes === null ||
    turno === null ||
    inicio === null
  ) {
    throw new ErrorDominio('tanda_invalida', 'faltan datos de la tanda');
  }
  return {
    ...(e.nombre ? { nombre: e.nombre } : {}),
    aportacion,
    participantes,
    turno,
    regla: e.regla ?? reglaDeFrecuencia(frecuencia, inicio),
    inicio,
    ...(e.aportacionesHechas !== null ? { aportacionesHechas: e.aportacionesHechas } : {}),
    ...(e.yaCobraste !== null ? { yaCobraste: e.yaCobraste } : {}),
  };
}

export const flujoTanda: FlujoConversacional<EstadoTanda> = {
  id: 'tanda',
  inicial: (ctx, origen) => {
    const c = comoContexto(ctx);
    const { desde } = desenvolver(origen);
    const e = vacio(c.reloj.hoy(), contextoInterprete(c));
    const porCrear = resultadoDe(desde, 'tanda_por_crear');
    if (porCrear) return conPropuesta(e, porCrear.propuesta);
    const l = typeof desde === 'string' ? leer(e, desde) : esLecturaTanda(desde) ? desde : null;
    if (!l) return e;
    const con = conLectura(e, l);
    return 'error' in con ? e : con;
  },
  pasos,
  entendi: (ctx, e, acciones) => {
    const p = proponerTanda(comoContexto(ctx), entradaTanda(e));
    const frecuencia = e.frecuencia ?? 'quincenal';
    const fechas = [...new Set([...e.cercanas, p.inicio])].sort();
    const filas: FilaEntendi[] = [
      {
        clave: 'aportacion',
        etiqueta: T.ETIQUETA_DAS,
        valor: T.valorDas(p.aportacion, T.FRECUENCIAS_TANDA_TEXTO[frecuencia]),
      },
      filaTocable(
        {
          clave: 'frecuencia',
          etiqueta: T.ETIQUETA_FRECUENCIA,
          valor: T.FRECUENCIAS_TANDA_TEXTO[frecuencia],
        },
        CHIPS_FRECUENCIA.map((c) => opcion(c.valor, c.etiqueta)),
        acciones,
        (v) =>
          (FRECUENCIAS_TANDA as readonly string[]).includes(v)
            ? { ...e, frecuencia: v as FrecuenciaTanda, regla: null }
            : null,
      ),
      { clave: 'participantes', etiqueta: T.ETIQUETA_SON, valor: T.valorSon(p.participantes) },
      { clave: 'turno', etiqueta: T.ETIQUETA_TURNO, valor: T.etiquetaChipTurno(p.turno) },
      { clave: 'cobras', etiqueta: T.ETIQUETA_COBRAS, valor: T.valorCobras(p.cobro, p.fechaCobro) },
      filaTocable(
        { clave: 'inicio', etiqueta: T.ETIQUETA_PRIMERA_RONDA, valor: T.fechaCorta(p.inicio) },
        fechas.map((f) => opcion(f, T.etiquetaChipFecha(f, e.hoy))),
        acciones,
        (v) =>
          fechas.includes(v)
            ? { ...e, inicio: v, regla: null, aportacionesHechas: null, yaCobraste: null }
            : null,
      ),
    ];
    if (p.yaEmpezo) {
      const hechas = p.yaEmpezo.aportacionesHechas;
      filas.push(
        filaTocable(
          { clave: 'llevas', etiqueta: T.ETIQUETA_LLEVAS, valor: T.valorLlevas(hechas) },
          p.participantes <= 12
            ? Array.from({ length: p.participantes + 1 }, (_, i) => opcion(String(i), T.valorLlevas(i)))
            : [],
          acciones,
          (v) => {
            const n = Number(v);
            return Number.isSafeInteger(n) && n >= 0 && n <= p.participantes
              ? { ...e, aportacionesHechas: n }
              : null;
          },
        ),
        filaTocable(
          {
            clave: 'ya_cobraste',
            etiqueta: T.ETIQUETA_YA_COBRASTE,
            valor: p.yaEmpezo.yaCobraste ? T.CHIP_SI : T.CHIP_TODAVIA_NO,
          },
          [opcion('si', T.CHIP_SI), opcion('no', T.CHIP_TODAVIA_NO)],
          acciones,
          (v) => (v === 'si' || v === 'no' ? { ...e, yaCobraste: v === 'si' } : null),
        ),
      );
    }
    return {
      titulo: T.TITULO_AGREGAR,
      monto: p.aportacion,
      filas,
      confirmar: { etiqueta: T.CONFIRMAR_AGREGAR, accion: acciones.guardar },
      cambiar: { etiqueta: T.CAMBIAR_ALGO, accion: acciones.cambiar },
    };
  },
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    const entrada = entradaTanda(e);
    const p = proponerTanda(c, entrada);
    const { cambioDia } = conCambioDia(c, () => crearTanda(c, entrada));
    return {
      texto: T.MENSAJE_TANDA,
      detalle: T.detalleTanda(p.cobro, p.fechaCobro),
      ...(cambioDia ? { cambioDia } : {}),
    };
  },
  formularioLargo: (e) => {
    try {
      dejarPrellenado('tanda', entradaTanda(e));
    } catch {
      // Incompleta: el formulario abre vacío.
    }
    return { pathname: '/registrar', params: { flujo: 'tanda' } };
  },
};
