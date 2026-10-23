import { ErrorDominio, type Centavos } from '@cartera/core';
import { interpretarPaso, type ContextoPaso } from '@cartera/nlu';
import {
  calcularArqueo,
  confirmarArqueo,
  moverEnPropuestaArqueo,
  prepararArqueo,
  resumenArqueo,
  type PropuestaArqueo,
  type RespuestaSobrante,
  type VistaArqueo,
} from '../../servicios/arqueo';
import { listarPersonas } from '../../servicios/personas';
import { contextoInterprete } from '../../servicios/registrar';
import { formatearCentavos } from '../../ui/formato';
import type { FilaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, PasoFlujo } from '../tipos';
import {
  campoDe,
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  elegirSiNo,
  filaTocable,
  leerMonto,
  opcion,
  resultadoDe,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Arqueo por voz (Ola 7 §7, `02 §7`, E7): «¿Cuánto efectivo traes? Deberías traer $640.» (monto, admite cero) →
 * «Entendí» «Traes $300: faltan $340» con el reparto de E7 como filas (tocar una la pasa a otra categoría) →
 * `confirmarArqueo`. Entra por «traigo 300» (ya trae el monto) o por el chip «Contar efectivo». Antes, como la
 * pantalla de arqueo, pregunta por los gastos sin método de más de 24 h (E7-08: se reasignan antes de contar), y un
 * sobrante nunca se registra sin decir de dónde salió (E7-09).
 */

export interface EstadoArqueo {
  readonly contexto: ContextoPaso;
  readonly vista: VistaArqueo;
  /** Gastos por asignar ya contestados («¿Pagaste … en efectivo?»). */
  readonly respondidos: readonly string[];
  readonly marcados: readonly string[];
  /** «Deberías traer» con los marcados (E7). */
  readonly esperado: Centavos;
  readonly efectivoReal: Centavos | null;
  readonly aproximado: boolean;
  /** > 0 faltan, < 0 sobran; `null` mientras no se sepa cuánto traes. */
  readonly hueco: Centavos | null;
  readonly sobrante: RespuestaSobrante | null;
  /** Personas que te deben (para «Me pagó Ana»). */
  readonly personasQueDeben: readonly { readonly id: string; readonly nombre: string }[];
  /** Reparto movido en «Entendí»; sin él, el de E7. */
  readonly propuesta: readonly PropuestaArqueo[] | null;
}

/** Recalcula «deberías traer» y el hueco; lo que dependía del hueco anterior se vuelve a decidir. */
function recalcular(e: EstadoArqueo): EstadoArqueo {
  const r = resumenArqueo(e.vista, e.marcados, e.efectivoReal);
  return { ...e, esperado: r.esperado, hueco: r.hueco, sobrante: null, propuesta: null };
}

/**
 * Por voz se pregunta por los primeros gastos sin método, uno por turno; los que pasen de este tope se quedan por
 * asignar (no se cuentan como efectivo: puede faltar de más, nunca de menos) y «Cambiar» abre la lista completa.
 */
export const MAX_POR_ASIGNAR_VOZ = 5;

/** Gastos sin método que no se preguntan por voz (más allá del tope). */
const sinRevisar = (e: EstadoArqueo): number => Math.max(0, e.vista.porAsignar.length - MAX_POR_ASIGNAR_VOZ);

const CHIP_EN_EFECTIVO: ChipRespuesta = { valor: 'si', etiqueta: T.CHIP_EN_EFECTIVO };
const CHIP_NO: ChipRespuesta = { valor: 'no', etiqueta: T.CHIP_NO };

function opcionesSobrante(e: EstadoArqueo): ChipRespuesta[] {
  return [
    { valor: 'me_dieron', etiqueta: T.OPCIONES_SOBRANTE.me_dieron },
    ...e.personasQueDeben.map((p) => ({ valor: `me_pagaron:${p.id}`, etiqueta: T.opcionMePago(p.nombre) })),
    { valor: 'anote_de_mas', etiqueta: T.OPCIONES_SOBRANTE.anote_de_mas },
    { valor: 'no_se', etiqueta: T.OPCIONES_SOBRANTE.no_se },
  ];
}

function sobranteDe(valor: string): RespuestaSobrante | null {
  if (valor === 'me_dieron' || valor === 'anote_de_mas' || valor === 'no_se') return { tipo: valor };
  const [tipo, personaId] = valor.split(':');
  return tipo === 'me_pagaron' && personaId ? { tipo: 'me_pagaron', personaId } : null;
}

function valorSobrante(s: RespuestaSobrante | null): string {
  if (s === null) return 'no_se';
  return s.tipo === 'me_pagaron' ? `me_pagaron:${s.personaId}` : s.tipo;
}

/** «¿Pagaste Coca $25 (sáb 10) en efectivo?» por el k-ésimo gasto sin método (cada uno con su id de paso). */
function pasoPorAsignar(k: number): PasoFlujo<EstadoArqueo> {
  const gasto = (e: EstadoArqueo) => e.vista.porAsignar[k - 1];
  return {
    id: `por_asignar-${k}`,
    pregunta: (e) => {
      const g = gasto(e);
      return g ? T.preguntaPorAsignar(g.descripcion ?? T.GASTO_SIN_DESCRIPCION, g.monto, g.etiqueta) : '';
    },
    ayuda: () => T.AYUDA_POR_ASIGNAR,
    chips: () => [CHIP_EN_EFECTIVO, CHIP_NO],
    omitirSi: (e) => {
      const g = gasto(e);
      return !g || e.respondidos.includes(g.transaccionId);
    },
    aplicar: (e, r) => {
      const g = gasto(e);
      if (!g) return { error: T.ERROR_PASO };
      const v = elegirSiNo(r, CHIP_EN_EFECTIVO, CHIP_NO);
      if (v === null) return { error: T.ERROR_ELEGIR };
      return recalcular({
        ...e,
        respondidos: [...e.respondidos, g.transaccionId],
        marcados: v === 'si' ? [...e.marcados, g.transaccionId] : e.marcados,
      });
    },
  };
}

const pasos: readonly PasoFlujo<EstadoArqueo>[] = [
  ...Array.from({ length: MAX_POR_ASIGNAR_VOZ }, (_, i) => pasoPorAsignar(i + 1)),
  {
    id: 'efectivo',
    pregunta: (e) => T.preguntaEfectivo(e.esperado),
    campo: 'monto',
    admiteCero: true,
    chips: (e) =>
      e.esperado >= 0 ? [{ valor: String(e.esperado), etiqueta: T.chipTraigo(e.esperado) }] : [],
    omitirSi: (e) => e.efectivoReal !== null,
    aplicar: (e, r) => {
      // «traigo como 300», «ya no traigo nada» (A01–A04) o la cifra sola.
      const l = r.tipo === 'texto' ? interpretarPaso('efectivo', r.texto, e.contexto) : null;
      const m =
        l?.paso === 'efectivo'
          ? { centavos: l.efectivo.monto, aproximado: l.efectivo.aproximado }
          : leerMonto(r, true);
      if (m === null) return { error: T.ERROR_MONTO };
      return recalcular({ ...e, efectivoReal: m.centavos, aproximado: m.aproximado });
    },
  },
  {
    id: 'sobrante',
    pregunta: (e) => T.preguntaSobrante(-(e.hueco ?? 0)),
    chips: opcionesSobrante,
    omitirSi: (e) => e.hueco === null || e.hueco >= 0 || e.sobrante !== null,
    aplicar: (e, r) => {
      const v = elegir(r, opcionesSobrante(e));
      const s = v === null ? null : sobranteDe(v);
      return s === null ? { error: T.ERROR_ELEGIR } : { ...e, sobrante: s };
    },
  },
];

export const flujoArqueo: FlujoConversacional<EstadoArqueo> = {
  id: 'arqueo',
  noDisponible: (ctx) => {
    try {
      prepararArqueo(comoContexto(ctx));
      return null;
    } catch (error) {
      if (error instanceof ErrorDominio) return T.SIN_EFECTIVO;
      throw error;
    }
  },
  inicial: (ctx, origen) => {
    const c = comoContexto(ctx);
    const { desde } = desenvolver(origen);
    const dicho = resultadoDe(desde, 'arqueo');
    const cuentaId = campoDe(desde, 'cuentaId');
    const vista = prepararArqueo(c, cuentaId ?? undefined);
    return recalcular({
      contexto: contextoInterprete(c),
      vista,
      respondidos: [],
      marcados: [],
      esperado: vista.saldo,
      efectivoReal: dicho ? dicho.efectivoReal : null,
      aproximado: false,
      hueco: null,
      sobrante: null,
      personasQueDeben: listarPersonas(c)
        .filter((p) => p.saldo > 0)
        .map((p) => ({ id: p.cuentaId, nombre: p.nombre })),
      propuesta: null,
    });
  },
  pasos,
  entendi: (ctx, e, acciones) => {
    const c = comoContexto(ctx);
    const traes = e.efectivoReal ?? 0;
    const calculo = calcularArqueo(c, {
      cuentaId: e.vista.cuentaId,
      efectivoReal: traes,
      marcados: e.marcados,
    });
    const filas: FilaEntendi[] = [];
    let titulo: string;
    let efecto: string | undefined;
    if (calculo.hueco > 0) {
      titulo = T.tituloFaltan(traes, calculo.hueco);
      efecto = T.EFECTO_REPARTO;
      const propuesta = e.propuesta ?? calculo.propuesta;
      for (const p of propuesta) {
        filas.push(
          filaTocable(
            { clave: `reparto-${p.categoria}`, etiqueta: p.nombre, valor: formatearCentavos(p.monto) },
            propuesta
              .filter((x) => x.categoria !== p.categoria)
              .map((x) => opcion(x.categoria, T.opcionPasarA(x.nombre))),
            acciones,
            (destino) => ({ ...e, propuesta: moverEnPropuestaArqueo(propuesta, p.categoria, destino) }),
          ),
        );
      }
    } else if (calculo.hueco < 0) {
      titulo = T.tituloSobran(traes, -calculo.hueco);
      const opciones = opcionesSobrante(e);
      const actual = valorSobrante(e.sobrante);
      filas.push(
        filaTocable(
          {
            clave: 'de_donde',
            etiqueta: T.ETIQUETA_DE_DONDE,
            valor: opciones.find((o) => o.valor === actual)?.etiqueta ?? T.OPCIONES_SOBRANTE.no_se,
          },
          opciones.map((o) => opcion(o.valor, o.etiqueta)),
          acciones,
          (v) => {
            const s = sobranteDe(v);
            return s ? { ...e, sobrante: s } : null;
          },
        ),
      );
    } else {
      titulo = T.tituloCuadra(traes);
    }
    if (sinRevisar(e) > 0) {
      filas.push({
        clave: 'sin_revisar',
        etiqueta: T.ETIQUETA_SIN_REVISAR,
        valor: T.valorSinRevisar(sinRevisar(e)),
      });
    }
    if (e.marcados.length > 0) {
      filas.push({
        clave: 'marcados',
        etiqueta: T.ETIQUETA_MARCADOS,
        valor: T.valorMarcados(e.marcados.length, calculo.reasignado),
      });
    }
    return {
      titulo,
      filas,
      ...(efecto ? { efecto } : {}),
      ...(e.aproximado ? { pista: T.pistaAproximado(traes) } : {}),
      confirmar: { etiqueta: T.CONFIRMAR, accion: acciones.guardar },
      cambiar: { etiqueta: T.CAMBIAR, accion: acciones.cambiar },
    };
  },
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    if (e.efectivoReal === null) throw new ErrorDominio('falta_efectivo', 'falta cuánto traes');
    const efectivoReal = e.efectivoReal;
    const { resultado, cambioDia } = conCambioDia(c, () =>
      confirmarArqueo(c, {
        cuentaId: e.vista.cuentaId,
        efectivoReal,
        marcados: e.marcados,
        ...(e.propuesta
          ? { propuesta: e.propuesta.map((p) => ({ categoria: p.categoria, monto: p.monto })) }
          : {}),
        ...(e.sobrante ? { sobrante: e.sobrante } : {}),
      }),
    );
    return {
      texto: resultado.calculo.hueco === 0 ? T.MENSAJE_CUADRA : T.mensajeEfectivoQuedo(efectivoReal),
      ...(cambioDia ? { cambioDia } : {}),
    };
  },
  formularioLargo: (e) => {
    dejarPrellenado('arqueo', { efectivoReal: e.efectivoReal, marcados: [...e.marcados] });
    return { pathname: '/arqueo', params: { cuenta: e.vista.cuentaId } };
  },
};
