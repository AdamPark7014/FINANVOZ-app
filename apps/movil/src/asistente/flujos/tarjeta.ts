import { ErrorDominio, type Centavos } from '@cartera/core';
import {
  INSTITUCIONES,
  interpretarPaso,
  normalizarAlias,
  type ContextoPaso,
  type LecturaDe,
} from '@cartera/nlu';
import type { TarjetaPorAgregar } from '../../servicios/config-tarjetas';
import { agregarTarjetaCredito, type EntradaTarjeta } from '../../servicios/onboarding';
import { contextoInterprete } from '../../servicios/registrar';
import { limiteSinDato } from '../../servicios/tarjetas';
import { formatearCentavos } from '../../ui/formato';
import type { FilaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, PasoFlujo } from '../tipos';
import {
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  elegirSiNo,
  filaTocable,
  leerEntero,
  leerMonto,
  mayuscula,
  opcion,
  resultadoDe,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Agregar tarjeta de crédito por voz (Ola 7 §6, CA-O7 6): «tengo una Nu que corta el 28 y pago el 18» llena nombre
 * y ciclo; solo se pregunta lo que falta (cuánto debes hoy, si la pagas completa y, si no se dijeron, corte y día
 * de pago) → «Entendí · ¿la agrego?» → `agregarTarjetaCredito` (el saldo sigue siendo obligatorio, `02 §3.1`).
 * Sin límite dicho se guarda `limiteSinDato` (no se pregunta para no pasar de dos preguntas).
 */

type Modo = 'totalero' | 'plan';
type Incluye = 'si' | 'no' | 'no_se';

export interface EstadoTarjeta {
  /** Contexto del intérprete para leer lo que se conteste («debo como 3 mil», «la pago completa»). */
  readonly contexto: ContextoPaso;
  readonly nombre: string | null;
  /** Lo dicho tal cual («nu»), para reconocerla la próxima vez. */
  readonly alias: string | null;
  readonly ultimos4: string | null;
  readonly diaCorte: number | null;
  readonly diaLimitePago: number | null;
  readonly diasParaPagar: number | null;
  readonly limiteCredito: Centavos | null;
  readonly saldo: Centavos | null;
  readonly saldoAproximado: boolean;
  readonly modo: Modo | null;
  readonly msiPrevios: readonly { readonly mensualidad: Centavos; readonly restantes: number }[];
  readonly saldoIncluyeMsi: Incluye | null;
}

type LecturaTarjeta = LecturaDe<'tarjeta'>;

function vacio(contexto: ContextoPaso): EstadoTarjeta {
  return {
    contexto,
    nombre: null,
    alias: null,
    ultimos4: null,
    diaCorte: null,
    diaLimitePago: null,
    diasParaPagar: null,
    limiteCredito: null,
    saldo: null,
    saldoAproximado: false,
    modo: null,
    msiPrevios: [],
    saldoIncluyeMsi: null,
  };
}

function leer(e: EstadoTarjeta, texto: string): LecturaTarjeta | null {
  const l = interpretarPaso('tarjeta', texto, e.contexto);
  return l?.paso === 'tarjeta' ? l : null;
}

/** Lo que trae una lectura pisa lo anterior; lo que no trae se queda. */
function conLectura(e: EstadoTarjeta, l: LecturaTarjeta): EstadoTarjeta {
  return {
    ...e,
    ...(l.nombre !== undefined ? { nombre: l.nombre } : {}),
    ...(l.ultimos4 !== undefined ? { ultimos4: l.ultimos4 } : {}),
    ...(l.diaCorte !== undefined ? { diaCorte: l.diaCorte } : {}),
    ...(l.diaLimitePago !== undefined ? { diaLimitePago: l.diaLimitePago, diasParaPagar: null } : {}),
    ...(l.diasParaPagar !== undefined ? { diasParaPagar: l.diasParaPagar, diaLimitePago: null } : {}),
    ...(l.limiteCredito ? { limiteCredito: l.limiteCredito.monto } : {}),
    ...(l.saldo ? { saldo: l.saldo.monto, saldoAproximado: l.saldo.aproximado } : {}),
    ...(l.modo ? { modo: l.modo } : {}),
    ...(l.msiPrevios ? { msiPrevios: l.msiPrevios, saldoIncluyeMsi: null } : {}),
  };
}

function institucionDe(nombre: string) {
  const n = normalizarAlias(nombre);
  return INSTITUCIONES.find((i) => i.credito && (normalizarAlias(i.nombre) === n || i.alias.includes(n)));
}

/** `tarjeta_por_agregar` de `registrarTexto` («mi Nu corta el 28…» con una Nu que no existe). */
function conPorAgregar(e: EstadoTarjeta, p: TarjetaPorAgregar): EstadoTarjeta {
  const alias = p.alias?.trim() || null;
  return {
    ...e,
    nombre: alias ? (institucionDe(alias)?.nombre ?? mayuscula(alias)) : null,
    alias,
    diaCorte: p.diaCorte,
    diaLimitePago: p.diaLimitePago,
    diasParaPagar: p.diaLimitePago === null ? p.diasParaPagar : null,
  };
}

const esLecturaTarjeta = (x: unknown): x is LecturaTarjeta =>
  x !== null && typeof x === 'object' && (x as { paso?: unknown }).paso === 'tarjeta';

const esPorAgregar = (x: unknown): x is TarjetaPorAgregar =>
  x !== null && typeof x === 'object' && 'alias' in x && 'diaCorte' in x && 'diaLimitePago' in x;

const nombreDe = (e: EstadoTarjeta): string => e.nombre ?? 'tarjeta';

const CHIPS_NOMBRE: readonly ChipRespuesta[] = ['Nu', 'BBVA', 'Banamex', 'Santander', 'Banorte']
  .filter((n) => institucionDe(n))
  .map((n) => ({ valor: n, etiqueta: n }));

const CHIP_TOTALERO: ChipRespuesta = { valor: 'totalero', etiqueta: T.CHIP_COMPLETA };
const CHIP_PLAN: ChipRespuesta = { valor: 'plan', etiqueta: T.CHIP_UNA_PARTE };
const CHIPS_INCLUYE: readonly ChipRespuesta[] = [
  { valor: 'si', etiqueta: T.CHIP_INCLUYE },
  { valor: 'no', etiqueta: T.CHIP_NO },
  { valor: 'no_se', etiqueta: T.CHIP_NO_SE },
];

const pasos: readonly PasoFlujo<EstadoTarjeta>[] = [
  {
    id: 'nombre',
    pregunta: () => T.PREGUNTA_NOMBRE_TARJETA,
    ayuda: () => T.AYUDA_NOMBRE_TARJETA,
    campo: 'texto',
    chips: () => CHIPS_NOMBRE,
    omitirSi: (e) => e.nombre !== null,
    aplicar: (e, r) => {
      if (r.tipo === 'chip') {
        const v = elegir(r, CHIPS_NOMBRE);
        return v === null ? { error: T.ERROR_NOMBRE_TARJETA } : { ...e, nombre: v };
      }
      if (r.tipo !== 'texto') return { error: T.ERROR_NOMBRE_TARJETA };
      const l = leer(e, r.texto);
      // «la Banorte, corta el 5» trae más que el nombre; «corta el 5» no lo trae: error en la misma pregunta (un
      // paso contestado no se vuelve a preguntar).
      if (l) return l.nombre !== undefined ? conLectura(e, l) : { error: T.ERROR_NOMBRE_TARJETA };
      const limpio = r.texto.trim();
      if (limpio === '' || limpio.length > 60) return { error: T.ERROR_NOMBRE_TARJETA };
      return { ...e, nombre: institucionDe(limpio)?.nombre ?? mayuscula(limpio), alias: e.alias ?? limpio };
    },
  },
  {
    id: 'corte',
    pregunta: (e) => T.preguntaCorte(nombreDe(e)),
    ayuda: () => T.AYUDA_CORTE,
    campo: 'texto',
    omitirSi: (e) => e.diaCorte !== null,
    aplicar: (e, r) => {
      if (r.tipo === 'texto') {
        const l = leer(e, r.texto);
        if (l?.diaCorte !== undefined) return conLectura(e, l);
      }
      const d = leerEntero(r, 1, 31);
      return d === null ? { error: T.ERROR_CORTE } : { ...e, diaCorte: d };
    },
  },
  {
    id: 'pago',
    pregunta: (e) => T.preguntaPagoTarjeta(nombreDe(e)),
    ayuda: () => T.AYUDA_PAGO_TARJETA,
    campo: 'texto',
    omitirSi: (e) => e.diaLimitePago !== null || e.diasParaPagar !== null,
    aplicar: (e, r) => {
      if (r.tipo === 'texto') {
        const l = leer(e, r.texto);
        if (l && (l.diaLimitePago !== undefined || l.diasParaPagar !== undefined)) return conLectura(e, l);
        if (/d[ií]as/i.test(r.texto)) {
          const n = leerEntero(r, 1, 60);
          return n === null
            ? { error: T.ERROR_PAGO_TARJETA }
            : { ...e, diasParaPagar: n, diaLimitePago: null };
        }
      }
      const d = leerEntero(r, 1, 31);
      return d === null ? { error: T.ERROR_PAGO_TARJETA } : { ...e, diaLimitePago: d, diasParaPagar: null };
    },
  },
  {
    id: 'saldo',
    pregunta: (e) => T.preguntaSaldoTarjeta(nombreDe(e)),
    ayuda: () => T.AYUDA_SALDO_TARJETA,
    campo: 'monto',
    admiteCero: true,
    chips: () => [{ valor: '0', etiqueta: T.CHIP_NO_DEBO }],
    omitirSi: (e) => e.saldo !== null,
    aplicar: (e, r) => {
      if (r.tipo === 'texto') {
        const l = leer(e, r.texto);
        if (l?.saldo) return conLectura(e, l);
      }
      const m = leerMonto(r, true);
      return m === null
        ? { error: T.ERROR_MONTO }
        : { ...e, saldo: m.centavos, saldoAproximado: m.aproximado };
    },
  },
  {
    id: 'modo',
    pregunta: () => T.PREGUNTA_MODO,
    chips: () => [CHIP_TOTALERO, CHIP_PLAN],
    omitirSi: (e) => e.modo !== null,
    aplicar: (e, r) => {
      if (r.tipo === 'texto') {
        const l = leer(e, r.texto);
        if (l?.modo) return conLectura(e, l);
      }
      const v = elegirSiNo(r, CHIP_TOTALERO, CHIP_PLAN);
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, modo: v as Modo };
    },
  },
  {
    id: 'incluye_msi',
    pregunta: () => T.PREGUNTA_INCLUYE_MSI,
    chips: () => CHIPS_INCLUYE,
    omitirSi: (e) => e.msiPrevios.length === 0 || e.saldoIncluyeMsi !== null,
    aplicar: (e, r) => {
      const v =
        elegir(r, CHIPS_INCLUYE) ??
        (r.tipo === 'texto'
          ? elegirSiNo(r, CHIPS_INCLUYE[0] as ChipRespuesta, CHIPS_INCLUYE[1] as ChipRespuesta)
          : null);
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, saldoIncluyeMsi: v as Incluye };
    },
  },
];

/** La entrada de `agregarTarjetaCredito`; `tarjeta_invalida` si todavía falta algo. */
export function entradaTarjeta(e: EstadoTarjeta): EntradaTarjeta {
  const { nombre, diaCorte, saldo, modo } = e;
  if (
    nombre === null ||
    diaCorte === null ||
    saldo === null ||
    modo === null ||
    (e.diaLimitePago === null && e.diasParaPagar === null) ||
    (e.msiPrevios.length > 0 && e.saldoIncluyeMsi === null)
  ) {
    throw new ErrorDominio('tarjeta_invalida', 'faltan datos de la tarjeta');
  }
  const institucion = institucionDe(nombre);
  const alias = e.alias !== null && normalizarAlias(e.alias) !== normalizarAlias(nombre) ? [e.alias] : [];
  return {
    nombre,
    ...(e.ultimos4 !== null ? { ultimos4: e.ultimos4 } : {}),
    ...(institucion ? { institucion: institucion.id } : {}),
    alias,
    diaCorte,
    ...(e.diaLimitePago !== null
      ? { diaLimitePago: e.diaLimitePago }
      : { diasParaPagar: e.diasParaPagar ?? 0 }),
    limiteCredito: e.limiteCredito ?? limiteSinDato(saldo),
    modo,
    saldo,
    msiPrevios: e.msiPrevios.map((m) => ({ mensualidad: m.mensualidad, restantes: m.restantes })),
    ...(e.msiPrevios.length > 0 && e.saldoIncluyeMsi !== null ? { saldoIncluyeMsi: e.saldoIncluyeMsi } : {}),
  };
}

export const flujoTarjeta: FlujoConversacional<EstadoTarjeta> = {
  id: 'tarjeta',
  inicial: (ctx, origen) => {
    const { desde } = desenvolver(origen);
    let e = vacio(contextoInterprete(comoContexto(ctx)));
    const porAgregar = resultadoDe(desde, 'tarjeta_por_agregar');
    if (porAgregar) e = conPorAgregar(e, porAgregar.prellenado);
    else if (typeof desde === 'string') {
      const l = leer(e, desde);
      if (l) e = conLectura(e, l);
    } else if (esLecturaTarjeta(desde)) e = conLectura(e, desde);
    else if (esPorAgregar(desde)) e = conPorAgregar(e, desde);
    return e;
  },
  pasos,
  entendi: (_ctx, e, acciones) => {
    const filas: FilaEntendi[] = [
      { clave: 'tarjeta', etiqueta: T.ETIQUETA_TARJETA, valor: T.valorTarjeta(nombreDe(e)) },
      {
        clave: 'ciclo',
        etiqueta: T.ETIQUETA_CICLO,
        valor: T.valorCiclo(e.diaCorte ?? 0, e.diaLimitePago, e.diasParaPagar),
      },
      {
        clave: 'saldo',
        etiqueta: T.ETIQUETA_DEBES_HOY,
        valor: T.valorDebes(e.saldo ?? 0, e.saldoAproximado),
      },
      filaTocable<EstadoTarjeta>(
        {
          clave: 'modo',
          etiqueta: T.ETIQUETA_MODO,
          valor: e.modo === 'plan' ? T.MODO_PLAN : T.MODO_TOTALERO,
        },
        [opcion('totalero', T.MODO_TOTALERO), opcion('plan', T.MODO_PLAN)],
        acciones,
        (v) => (v === 'totalero' || v === 'plan' ? { ...e, modo: v } : null),
      ),
    ];
    if (e.limiteCredito !== null) {
      filas.push({ clave: 'limite', etiqueta: T.ETIQUETA_LIMITE, valor: formatearCentavos(e.limiteCredito) });
    }
    if (e.msiPrevios.length > 0) {
      filas.push({
        clave: 'meses',
        etiqueta: T.ETIQUETA_MESES_PREVIOS,
        valor: T.valorMesesPrevios(e.msiPrevios.length),
      });
      filas.push(
        filaTocable<EstadoTarjeta>(
          {
            clave: 'incluye',
            etiqueta: T.ETIQUETA_INCLUYE,
            valor: CHIPS_INCLUYE.find((c) => c.valor === e.saldoIncluyeMsi)?.etiqueta ?? T.CHIP_NO_SE,
          },
          CHIPS_INCLUYE.map((c) => opcion(c.valor, c.etiqueta)),
          acciones,
          (v) => (v === 'si' || v === 'no' || v === 'no_se' ? { ...e, saldoIncluyeMsi: v } : null),
        ),
      );
    }
    return {
      titulo: T.TITULO_AGREGAR,
      filas,
      confirmar: { etiqueta: T.CONFIRMAR_AGREGAR, accion: acciones.guardar },
      cambiar: { etiqueta: T.CAMBIAR_ALGO, accion: acciones.cambiar },
    };
  },
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    const entrada = entradaTarjeta(e);
    const { cambioDia } = conCambioDia(c, () => agregarTarjetaCredito(c, entrada));
    return { texto: T.mensajeTarjetaAgregada(entrada.nombre), ...(cambioDia ? { cambioDia } : {}) };
  },
  formularioLargo: (e) => {
    dejarPrellenado('tarjeta', {
      alias: e.alias ?? e.nombre,
      nombre: e.nombre,
      diaCorte: e.diaCorte,
      diaLimitePago: e.diaLimitePago,
      diasParaPagar: e.diasParaPagar,
      saldo: e.saldo,
      modo: e.modo,
      limiteCredito: e.limiteCredito,
    });
    return { pathname: '/tarjetas/nueva', params: { desde: 'asistente' } };
  },
};
