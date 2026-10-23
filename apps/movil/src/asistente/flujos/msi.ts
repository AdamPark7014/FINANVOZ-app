import { ErrorDominio, PLAZOS_MSI, type PlainDate } from '@cartera/core';
import { cuentaPorId, idCategoriaDe } from '../../servicios/catalogo';
import type { Contexto } from '../../servicios/contexto';
import { previsualizarCompraMsi, type EntradaCompraMsi } from '../../servicios/msi';
import { confirmarCompraMsi, type CuentaPorElegir, type ResultadoTexto } from '../../servicios/registrar';
import { tarjetasActivas } from '../../servicios/tarjetas';
import type { FilaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, PasoFlujo } from '../tipos';
import {
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  filaTocable,
  mayuscula,
  opcion,
  resultadoDe,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Compra a meses (Ola 7 §6): desde `confirmar_msi` de `registrarTexto` («compré una tele de 12 mil a 12 meses con
 * la oro»). Si falta la tarjeta, una pregunta con chips; después «Entendí» con meses, mensualidad (el calendario de
 * E6.1, `previsualizarCompraMsi`) y tarjeta como filas con opciones → `confirmarCompraMsi`.
 */

type Confirmar = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;

export interface EstadoMsi {
  readonly hoy: PlainDate;
  readonly porVoz: boolean;
  readonly motivo: Confirmar['motivo'];
  readonly entrada: Omit<EntradaCompraMsi, 'tarjetaId'>;
  readonly tarjetaId: string | null;
  /** La que ya venía elegida (dicha o el único parecido). */
  readonly preelegida: string | null;
  /** Tarjetas de crédito activas (para la pregunta y la fila «Tarjeta»). */
  readonly tarjetas: readonly { readonly id: string; readonly nombre: string }[];
  readonly faltaTarjeta: Omit<CuentaPorElegir, 'campo'> | null;
}

function chipsTarjeta(e: EstadoMsi): ChipRespuesta[] {
  const candidatas =
    e.faltaTarjeta && e.faltaTarjeta.candidatas.length > 0 ? e.faltaTarjeta.candidatas : e.tarjetas;
  return candidatas.map((t) => ({ valor: t.id, etiqueta: t.nombre }));
}

/**
 * El alias que no se reconoció («la ora») se aprende para la tarjeta que la persona eligió, si no es la que ya venía
 * elegida (mismo criterio que la confirmación de siempre).
 */
function aliasPorAprender(e: EstadoMsi): string | null {
  const f = e.faltaTarjeta;
  return f && f.motivo !== 'ambigua' && f.alias && e.tarjetaId && e.tarjetaId !== e.preelegida
    ? f.alias
    : null;
}

function nombreTarjeta(e: EstadoMsi): string {
  return e.tarjetas.find((t) => t.id === e.tarjetaId)?.nombre ?? '';
}

function queCompraste(ctx: Contexto, entrada: EstadoMsi['entrada']): string {
  if (entrada.descripcion) return mayuscula(entrada.descripcion);
  try {
    return cuentaPorId(ctx, idCategoriaDe(ctx, entrada.categoria ?? 'otros_gastos', 'gasto')).nombre;
  } catch {
    return '';
  }
}

const pasos: readonly PasoFlujo<EstadoMsi>[] = [
  {
    id: 'tarjeta',
    pregunta: (e) =>
      e.faltaTarjeta?.motivo === 'no_encontrada' && e.faltaTarjeta.alias
        ? T.preguntaTarjetaNoEncontrada(e.faltaTarjeta.alias)
        : T.PREGUNTA_TARJETA_MSI,
    chips: chipsTarjeta,
    omitirSi: (e) => e.tarjetaId !== null,
    aplicar: (e, r) => {
      const v = elegir(r, chipsTarjeta(e));
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, tarjetaId: v };
    },
  },
];

export const flujoMsi: FlujoConversacional<EstadoMsi> = {
  id: 'msi',
  noDisponible: (ctx) => (tarjetasActivas(comoContexto(ctx)).length === 0 ? T.SIN_TARJETAS_MSI : null),
  inicial: (ctx, origen) => {
    const c = comoContexto(ctx);
    const { desde, porVoz } = desenvolver(origen);
    const r = resultadoDe(desde, 'confirmar_msi');
    if (!r) throw new ErrorDominio('flujo_sin_origen', 'la compra a meses empieza con lo que dijiste');
    const { tarjetaId, ...entrada } = r.propuesta.entrada;
    const falta = r.propuesta.faltaTarjeta;
    const [unica] = falta?.candidatas ?? [];
    // Con un solo parecido («la ora» → Oro) ya viene elegida; «Entendí» la muestra para cambiarla.
    const elegida =
      tarjetaId ??
      (falta?.motivo === 'aproximado' && falta.candidatas.length === 1 && unica ? unica.id : null);
    return {
      hoy: c.reloj.hoy(),
      porVoz,
      motivo: r.motivo,
      entrada,
      tarjetaId: elegida,
      preelegida: elegida,
      tarjetas: tarjetasActivas(c).map((t) => ({ id: t.cuentaId, nombre: t.nombre })),
      faltaTarjeta: falta,
    };
  },
  pasos,
  entendi: (ctx, e, acciones) => {
    const c = comoContexto(ctx);
    const filas: FilaEntendi[] = [
      { clave: 'que', etiqueta: T.ETIQUETA_QUE, valor: queCompraste(c, e.entrada) },
    ];
    const plazos = [...new Set<number>([...PLAZOS_MSI, e.entrada.meses])].sort((a, b) => a - b);
    filas.push(
      filaTocable(
        { clave: 'meses', etiqueta: T.ETIQUETA_MESES, valor: T.valorMeses(e.entrada.meses) },
        plazos.map((n) => opcion(String(n), T.valorMeses(n))),
        acciones,
        (v) => {
          const n = Number(v);
          return Number.isSafeInteger(n) && n >= 2 && n <= 48
            ? { ...e, entrada: { ...e.entrada, meses: n } }
            : null;
        },
      ),
    );
    if (e.tarjetaId) {
      const cuotas = previsualizarCompraMsi(c, {
        tarjetaId: e.tarjetaId,
        monto: e.entrada.monto,
        meses: e.entrada.meses,
        ...(e.entrada.fecha ? { fecha: e.entrada.fecha } : {}),
        ...(e.entrada.mesesDiferimiento !== undefined
          ? { mesesDiferimiento: e.entrada.mesesDiferimiento }
          : {}),
      });
      const [primera] = cuotas;
      const ultima = cuotas[cuotas.length - 1];
      if (primera && ultima) {
        const conMas = cuotas.filter((q) => q.monto === primera.monto).length;
        filas.push({
          clave: 'mensualidad',
          etiqueta: T.ETIQUETA_CADA_MES,
          valor: T.valorMensualidad(primera.monto, ultima.monto, conMas),
        });
        filas.push({
          clave: 'primer_pago',
          etiqueta: T.ETIQUETA_PRIMER_PAGO,
          valor: T.fechaCorta(primera.limite),
        });
      }
    }
    filas.push(
      filaTocable(
        { clave: 'tarjeta', etiqueta: T.ETIQUETA_TARJETA, valor: nombreTarjeta(e) },
        e.tarjetas.map((t) => opcion(t.id, t.nombre)),
        acciones,
        (v) => (e.tarjetas.some((t) => t.id === v) ? { ...e, tarjetaId: v } : null),
      ),
    );
    if (e.entrada.fecha && e.entrada.fecha !== e.hoy) {
      filas.push({ clave: 'cuando', etiqueta: T.ETIQUETA_CUANDO, valor: T.fechaCorta(e.entrada.fecha) });
    }
    return {
      titulo: T.TITULO_REGISTRAR,
      monto: e.entrada.monto,
      filas,
      confirmar: { etiqueta: T.CONFIRMAR_REGISTRAR, accion: acciones.guardar },
      cambiar: { etiqueta: T.CAMBIAR_ALGO, accion: acciones.cambiar },
    };
  },
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    if (!e.tarjetaId) throw new ErrorDominio('meses_sin_tarjeta', 'falta la tarjeta');
    const alias = aliasPorAprender(e);
    const tarjetaId = e.tarjetaId;
    const { resultado, cambioDia } = conCambioDia(c, () =>
      confirmarCompraMsi(
        c,
        { ...e.entrada, tarjetaId },
        e.porVoz ? 'voz' : 'texto',
        alias ? { aprender: { alias } } : {},
      ),
    );
    const { compra } = resultado;
    const [primera] = compra.cuotas;
    return {
      texto: T.mensajeMsi(queCompraste(c, e.entrada), compra.monto, compra.meses, compra.tarjeta),
      ...(primera ? { detalle: T.detallePrimerPago(primera.limite) } : {}),
      ...(cambioDia ? { cambioDia } : {}),
      deshacer: resultado.deshacer,
    };
  },
  formularioLargo: (e) => {
    dejarPrellenado('msi', {
      resultado: 'confirmar_msi',
      motivo: e.motivo,
      propuesta: {
        entrada: { ...e.entrada, ...(e.tarjetaId ? { tarjetaId: e.tarjetaId } : {}) },
        faltaTarjeta: e.tarjetaId ? null : e.faltaTarjeta,
      },
    });
    return { pathname: '/registrar', params: { flujo: 'msi' } };
  },
};
