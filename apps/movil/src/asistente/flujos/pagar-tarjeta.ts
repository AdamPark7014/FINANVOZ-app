import { ErrorDominio, type Centavos, type PlainDate } from '@cartera/core';
import { listarCuentas } from '../../servicios/cuentas';
import { listarTarjetas, pagarTarjeta } from '../../servicios/vista-tarjetas';
import type { ChipRespuesta, PasoFlujo } from '../tipos';
import {
  campoDe,
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  filaTocable,
  leerMonto,
  opcion,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Pagar tarjeta (Ola 7 §5, chip «Pagar tarjeta» o el aviso de una tarjeta que vence): ¿cuál tarjeta? (chips) →
 * ¿cuánto? (monto, sugerido el pago para no generar intereses del último corte; sin corte cerrado, lo que debes)
 * → ¿de qué cuenta sale? (si hay más de una) → «Entendí» → `pagarTarjeta` con Deshacer.
 */

interface TarjetaPorPagar {
  readonly id: string;
  readonly nombre: string;
  /** Lo que propone el chip: el PNGI del último corte o, si es 0, la deuda (como `pagarTarjeta` por omisión). */
  readonly sugerido: Centavos;
  readonly pngi: Centavos;
  readonly fechaLimite: PlainDate;
}

export interface EstadoPagoTarjeta {
  readonly tarjetas: readonly TarjetaPorPagar[];
  readonly cuentas: readonly { readonly id: string; readonly nombre: string }[];
  readonly tarjetaId: string | null;
  readonly monto: Centavos | null;
  readonly origenId: string | null;
}

const tarjetaDe = (e: EstadoPagoTarjeta) => e.tarjetas.find((t) => t.id === e.tarjetaId);

const chipsTarjeta = (e: EstadoPagoTarjeta): ChipRespuesta[] =>
  e.tarjetas.map((t) => ({ valor: t.id, etiqueta: t.nombre }));

const chipsCuenta = (e: EstadoPagoTarjeta): ChipRespuesta[] =>
  e.cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }));

const pasos: readonly PasoFlujo<EstadoPagoTarjeta>[] = [
  {
    id: 'tarjeta',
    pregunta: () => T.PREGUNTA_CUAL_TARJETA,
    chips: chipsTarjeta,
    omitirSi: (e) => e.tarjetaId !== null,
    aplicar: (e, r) => {
      const v = elegir(r, chipsTarjeta(e));
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, tarjetaId: v, monto: null };
    },
  },
  {
    id: 'monto',
    pregunta: (e) => T.preguntaMontoPago(tarjetaDe(e)?.nombre ?? ''),
    ayuda: (e) => {
      const t = tarjetaDe(e);
      if (!t) return '';
      return t.pngi > 0 ? T.ayudaPngi(t.pngi, t.fechaLimite) : t.sugerido > 0 ? T.ayudaDeuda(t.sugerido) : '';
    },
    campo: 'monto',
    chips: (e) => {
      const t = tarjetaDe(e);
      return t && t.sugerido > 0 ? [{ valor: String(t.sugerido), etiqueta: T.chipPagar(t.sugerido) }] : [];
    },
    omitirSi: (e) => e.monto !== null,
    aplicar: (e, r) => {
      const m = leerMonto(r, false);
      return m === null ? { error: T.ERROR_MONTO } : { ...e, monto: m.centavos };
    },
  },
  {
    id: 'origen',
    pregunta: () => T.PREGUNTA_CUENTA_PAGO,
    chips: chipsCuenta,
    omitirSi: (e) => e.origenId !== null,
    aplicar: (e, r) => {
      const v = elegir(r, chipsCuenta(e));
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, origenId: v };
    },
  },
];

export const flujoPagarTarjeta: FlujoConversacional<EstadoPagoTarjeta> = {
  id: 'pagar_tarjeta',
  noDisponible: (ctx) => {
    const c = comoContexto(ctx);
    if (listarTarjetas(c).length === 0) return T.SIN_TARJETAS;
    if (listarCuentas(c).tienes.length === 0) return T.SIN_CUENTAS_PAGO;
    return null;
  },
  inicial: (ctx, origen) => {
    const c = comoContexto(ctx);
    const { desde } = desenvolver(origen);
    const tarjetas = listarTarjetas(c).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      sugerido: t.pngi > 0 ? t.pngi : Math.max(0, t.saldoRevolvente),
      pngi: t.pngi,
      fechaLimite: t.fechaLimite,
    }));
    const cuentas = listarCuentas(c).tienes.map((x) => ({ id: x.id, nombre: x.nombre }));
    const pedida = campoDe(desde, 'tarjetaId');
    const [unica] = tarjetas;
    const [unaCuenta] = cuentas;
    return {
      tarjetas,
      cuentas,
      tarjetaId:
        pedida && tarjetas.some((t) => t.id === pedida)
          ? pedida
          : tarjetas.length === 1 && unica
            ? unica.id
            : null,
      monto: null,
      origenId: cuentas.length === 1 && unaCuenta ? unaCuenta.id : null,
    };
  },
  pasos,
  entendi: (_ctx, e, acciones) => ({
    titulo: T.TITULO_REGISTRAR,
    ...(e.monto !== null ? { monto: e.monto } : {}),
    filas: [
      filaTocable(
        { clave: 'tarjeta', etiqueta: T.ETIQUETA_TARJETA, valor: tarjetaDe(e)?.nombre ?? '' },
        e.tarjetas.map((t) => opcion(t.id, t.nombre)),
        acciones,
        (v) => (e.tarjetas.some((t) => t.id === v) ? { ...e, tarjetaId: v } : null),
      ),
      filaTocable(
        {
          clave: 'origen',
          etiqueta: T.ETIQUETA_DESDE,
          valor: e.cuentas.find((x) => x.id === e.origenId)?.nombre ?? '',
        },
        e.cuentas.map((x) => opcion(x.id, x.nombre)),
        acciones,
        (v) => (e.cuentas.some((x) => x.id === v) ? { ...e, origenId: v } : null),
      ),
    ],
    confirmar: { etiqueta: T.CONFIRMAR_REGISTRAR, accion: acciones.guardar },
    cambiar: { etiqueta: T.CAMBIAR_ALGO, accion: acciones.cambiar },
  }),
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    const t = tarjetaDe(e);
    const { monto, origenId } = e;
    if (!t || monto === null || origenId === null)
      throw new ErrorDominio('movimiento_invalido', 'faltan datos del pago');
    const { resultado, cambioDia } = conCambioDia(c, () =>
      pagarTarjeta(c, { tarjetaId: t.id, origenId, monto }),
    );
    return {
      texto: T.mensajePago(t.nombre, monto),
      ...(cambioDia ? { cambioDia } : {}),
      deshacer: resultado.deshacer,
    };
  },
  formularioLargo: (e) => {
    dejarPrellenado('pagar_tarjeta', { tarjetaId: e.tarjetaId, monto: e.monto, origenId: e.origenId });
    return e.tarjetaId ? { pathname: '/tarjetas/[id]', params: { id: e.tarjetaId } } : '/cuentas';
  },
};
