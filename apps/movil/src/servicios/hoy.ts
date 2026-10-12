import { and, eq, inArray } from 'drizzle-orm';
import {
  dineroLibre,
  horizonte,
  maxFecha,
  proximasFechas,
  sumarDias,
  VENTANA_INGRESO_DESPUES,
  type Centavos,
  type DesgloseReservado,
  type EstadoHorizonte,
  type PlainDate,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { esIngresoVariable, obtenerColchon } from './ajustes';
import { avisosPendientes, type Aviso } from './avisos';
import type { Contexto } from './contexto';
import { dias as textoDias, etiquetaFecha } from './formato';
import { listarOcurrencias, materializarOcurrencias, pospuestaHoy } from './ocurrencias';
import { contarPorInterpretar } from './registrar';
import { ingresoPrincipal } from './programados';
import { cuotasMsiPendientes, tarjetasActivas } from './tarjetas';

const { cuenta } = esquema;

/** Estado de Hoy (`02 §4.2`, RF-HOY-03). */
export type EstadoHoy =
  'normal' | 'dia_de_pago' | 'retrasado' | 'ingreso_variable' | 'sin_ingreso' | 'libre_negativo';

/** Una línea de "Reservado (Nu, tanda, internet)". */
export interface ConceptoReservado {
  readonly tipo: 'compromiso' | 'tarjeta' | 'msi' | 'persona';
  readonly concepto: string;
  readonly monto: Centavos;
  readonly fecha: PlainDate | null;
}

/** Tarjetas de acción (`02 §4.1`), ya en orden de prioridad. */
export type TarjetaAccion =
  | {
      readonly tipo: 'compromiso_vencido';
      readonly programadoId: string;
      readonly fecha: PlainDate;
      /** "jue 15" */
      readonly etiquetaFecha: string;
      readonly concepto: string;
      readonly monto: Centavos;
      /** "¿Ya pagaste la luz?" */
      readonly pregunta: string;
      readonly opciones: readonly ['ya_la_pague', 'todavia_no', 'ya_no_aplica'];
    }
  | {
      readonly tipo: 'ingreso_no_llego';
      readonly programadoId: string;
      readonly fecha: PlainDate;
      readonly etiquetaFecha: string;
      readonly concepto: string;
      readonly monto: Centavos;
      /** `hoy` = es día de pago; `atrasado` = la fecha ya pasó. */
      readonly cuando: 'hoy' | 'atrasado';
      readonly pregunta: string;
      readonly opciones: readonly ['ya_llego', 'todavia_no', 'no_me_pagan'];
    }
  | { readonly tipo: 'por_interpretar'; readonly cantidad: number }
  | { readonly tipo: 'por_asignar'; readonly monto: Centavos };

export interface VistaHoy {
  readonly hoy: PlainDate;
  readonly estado: EstadoHoy;
  readonly estadoHorizonte: EstadoHorizonte;
  /** Cifra principal en centavos y en pesos mostrados (E4: `piso(hoy_puedes / 100)`). */
  readonly hoyPuedesCentavos: Centavos;
  readonly hoyPuedesPesos: number;
  /** Días entre hoy y el fin efectivo del horizonte. */
  readonly dias: number;
  /** Próximo ingreso que todavía no llega (E3.3 `fin`). */
  readonly proximoIngreso: {
    readonly concepto: string;
    readonly fecha: PlainDate;
    readonly etiqueta: string;
  } | null;
  readonly finEfectivo: PlainDate;
  /** "4 días para tu quincena (jue 15)" en estado normal. */
  readonly textoDias: string | null;
  /** Secundario sin cifras de `02 §4.2` (día de pago, retraso, ingreso variable, sin ingreso). */
  readonly mensaje: string | null;
  readonly liquidez: Centavos;
  readonly colchon: Centavos;
  readonly reservado: Centavos;
  readonly libre: Centavos;
  readonly faltante: Centavos;
  readonly desglose: DesgloseReservado;
  readonly reservadoDetalle: readonly ConceptoReservado[];
  /** Máximo dos visibles (`02 §4.1`). */
  readonly tarjetasAccion: readonly TarjetaAccion[];
  readonly avisos: readonly Aviso[];
}

/** L (`04 §2.2`): líquidas activas + `min(0, por_asignar)` + `min(0, tránsito)` del espacio personal. */
export function liquidez(ctx: Contexto): Centavos {
  const liquidas = ctx.db
    .select({ id: cuenta.id })
    .from(cuenta)
    .where(and(eq(cuenta.liquida, 1), eq(cuenta.archivada, 0), eq(cuenta.espacio, 'personal')))
    .all();
  let l = 0;
  for (const c of liquidas) l += ctx.libro.saldo(c.id);
  l += Math.min(0, ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar));
  l += Math.min(0, ctx.libro.saldo(CUENTAS_SISTEMA.transito));
  return l;
}

/** Lo que debes a personas (subtipos persona, cliente y pareja; las tandas no). */
export function deudasConPersonas(ctx: Contexto) {
  return ctx.db
    .select()
    .from(cuenta)
    .where(
      and(
        eq(cuenta.naturaleza, 'contraparte'),
        inArray(cuenta.subtipo, ['persona', 'cliente', 'pareja']),
        eq(cuenta.archivada, 0),
        eq(cuenta.espacio, 'personal'),
      ),
    )
    .all()
    .map((c) => ({ cuenta: c, saldo: ctx.libro.saldo(c.id) }))
    .filter((d) => d.saldo < 0)
    .map((d) => ({
      id: d.cuenta.id,
      nombre: d.cuenta.nombre,
      monto: -d.saldo,
      apartar: d.cuenta.apartarDeuda === 1,
    }));
}

/**
 * Hoy (`03 §5.3`): materializa ocurrencias (idempotente), E3.3 con las ocurrencias de ingreso ya recibidas y
 * E4 con L, colchón, compromisos pendientes (incluidos los vencidos), tarjetas, cuotas MSI y deudas con
 * personas. Todas las cifras salen de `packages/core`.
 */
export function obtenerHoy(ctx: Contexto): VistaHoy {
  materializarOcurrencias(ctx);
  const hoy = ctx.reloj.hoy();
  const ingreso = ingresoPrincipal(ctx);
  const variable = esIngresoVariable(ctx);

  // E3.3: recibidas = ocurrencias cubiertas u omitidas ("este periodo no me pagan") y las fechas anteriores
  // al alta del ingreso (el saldo que dio la persona ya las incluye).
  let recibidas: PlainDate[] = [];
  if (ingreso) {
    recibidas = listarOcurrencias(ctx, { programadoId: ingreso.id })
      .filter((o) => o.estado !== 'pendiente')
      .map((o) => o.fecha);
    for (const f of proximasFechas(ingreso.regla, sumarDias(hoy, -VENTANA_INGRESO_DESPUES), 6)) {
      if (f < ingreso.desde) recibidas.push(f);
    }
  }
  const h = horizonte(hoy, ingreso ? ingreso.regla : null, recibidas);

  const pendientes = listarOcurrencias(ctx, { estado: 'pendiente' });
  const compromisos = pendientes.filter((o) => o.tipo === 'egreso' && o.tarjetaId === null);
  const tarjetas = tarjetasActivas(ctx);
  const cuotas = cuotasMsiPendientes(ctx);
  const deudas = deudasConPersonas(ctx);
  const l = liquidez(ctx);
  const colchon = obtenerColchon(ctx);

  const r = dineroLibre({
    hoy,
    fin_horizonte: h.fin_efectivo,
    liquidez: l,
    colchon,
    compromisos: compromisos.map((o) => ({ concepto: o.concepto, fecha: o.fecha, monto: o.monto })),
    // M2 no tiene pagos planeados (RF-TAR-06, M4): una tarjeta en plan reserva su deuda completa (E4-08).
    tarjetas: tarjetas.map((t) => ({ id: t.cuentaId, modo: t.modo, saldo_revolvente: t.saldoRevolvente })),
    cuotas_msi_no_facturadas: cuotas.map((c) => ({ plan: c.planId, fecha_limite: c.limite, monto: c.monto })),
    deudas_personas: deudas.map((d) => ({ contraparte: d.id, monto: d.monto, apartar: d.apartar })),
  });

  // Mismo criterio de E4 para listar lo reservado.
  const finEf = maxFecha(h.fin_efectivo, sumarDias(hoy, 1));
  const nombreTarjeta = new Map(tarjetas.map((t) => [t.cuentaId, t.nombre]));
  const reservadoDetalle: ConceptoReservado[] = [
    ...tarjetas
      .filter((t) => t.saldoRevolvente > 0)
      .map((t) => ({ tipo: 'tarjeta' as const, concepto: t.nombre, monto: t.saldoRevolvente, fecha: null })),
    ...compromisos
      .filter((o) => o.fecha < finEf)
      .map((o) => ({ tipo: 'compromiso' as const, concepto: o.concepto, monto: o.monto, fecha: o.fecha })),
    ...cuotas
      .filter((c) => c.limite < finEf)
      .map((c) => ({
        tipo: 'msi' as const,
        concepto: nombreTarjeta.get(c.tarjetaId) ?? '',
        monto: c.monto,
        fecha: c.limite,
      })),
    ...deudas
      .filter((d) => d.apartar)
      .map((d) => ({ tipo: 'persona' as const, concepto: d.nombre, monto: d.monto, fecha: null })),
  ];

  const estado: EstadoHoy = !ingreso && !variable ? 'sin_ingreso' : r.libre < 0 ? 'libre_negativo' : h.estado;
  const concepto = ingreso?.concepto ?? 'quincena';
  const proximoIngreso =
    ingreso && h.estado !== 'ingreso_variable'
      ? { concepto, fecha: h.fin, etiqueta: etiquetaFecha(h.fin) }
      : null;

  let mensaje: string | null = null;
  if (estado === 'sin_ingreso') mensaje = 'Dime cada cuándo te pagan';
  else if (h.estado === 'dia_de_pago')
    mensaje = `Hoy es día de pago. Mientras llega tu depósito reparto en ${textoDias(r.dias)}; cuando llegue, recalculo.`;
  else if (h.estado === 'retrasado' && proximoIngreso)
    mensaje = `Tu ${concepto} del ${proximoIngreso.etiqueta} no ha llegado. Reparto en ${textoDias(r.dias)} más mientras llega.`;
  else if (h.estado === 'ingreso_variable') mensaje = `Reparto tu dinero libre en ${textoDias(r.dias)}.`;

  return {
    hoy,
    estado,
    estadoHorizonte: h.estado,
    hoyPuedesCentavos: r.hoy_puedes_centavos,
    hoyPuedesPesos: r.hoy_puedes_pesos_mostrados,
    dias: r.dias,
    proximoIngreso,
    finEfectivo: h.fin_efectivo,
    textoDias:
      h.estado === 'normal' && proximoIngreso
        ? `${textoDias(r.dias)} para tu ${concepto} (${proximoIngreso.etiqueta})`
        : null,
    mensaje,
    liquidez: l,
    colchon,
    reservado: r.reservado,
    libre: r.libre,
    faltante: r.faltante,
    desglose: r.desglose,
    reservadoDetalle,
    tarjetasAccion: tarjetasDeAccion(ctx, hoy, pendientes, ingreso?.id ?? null).slice(0, 2),
    avisos: avisosPendientes(ctx),
  };
}

function tarjetasDeAccion(
  ctx: Contexto,
  hoy: PlainDate,
  pendientes: ReturnType<typeof listarOcurrencias>,
  ingresoId: string | null,
): TarjetaAccion[] {
  const tarjetas: TarjetaAccion[] = [];
  // 1. Pago de tarjeta que vence en ≤ 3 días: llega con el cierre de cortes (M4).
  // 2. Compromiso vencido sin cubrir.
  for (const o of pendientes) {
    if (o.tipo !== 'egreso' || o.fecha >= hoy || pospuestaHoy(ctx, o)) continue;
    tarjetas.push({
      tipo: 'compromiso_vencido',
      programadoId: o.programadoId,
      fecha: o.fecha,
      etiquetaFecha: etiquetaFecha(o.fecha),
      concepto: o.concepto,
      monto: o.monto,
      pregunta: `¿Ya pagaste ${articulo(o.concepto)}?`,
      opciones: ['ya_la_pague', 'todavia_no', 'ya_no_aplica'],
    });
  }
  // 3. Ingreso que no llegó (de los últimos 31 días) o día de pago sin depósito.
  for (const o of pendientes) {
    if (o.programadoId !== ingresoId || o.fecha > hoy || o.fecha < sumarDias(hoy, -31)) continue;
    if (pospuestaHoy(ctx, o)) continue;
    const etiqueta = etiquetaFecha(o.fecha);
    const cuando = o.fecha === hoy ? 'hoy' : 'atrasado';
    tarjetas.push({
      tipo: 'ingreso_no_llego',
      programadoId: o.programadoId,
      fecha: o.fecha,
      etiquetaFecha: etiqueta,
      concepto: o.concepto,
      monto: o.monto,
      cuando,
      pregunta:
        cuando === 'hoy'
          ? `Hoy es día de pago. ¿Ya te llegó tu ${o.concepto}?`
          : `No vi llegar tu ${o.concepto} del ${etiqueta}. ¿Ya te pagaron?`,
      opciones: ['ya_llego', 'todavia_no', 'no_me_pagan'],
    });
  }
  // 4–5. Arqueo y preguntas de captura: M5. 6. Frases por interpretar ("Por revisar").
  const cantidad = contarPorInterpretar(ctx);
  if (cantidad > 0) tarjetas.push({ tipo: 'por_interpretar', cantidad });
  // 7. Gastos por asignar.
  const porAsignar = -ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar);
  if (porAsignar > 0) tarjetas.push({ tipo: 'por_asignar', monto: porAsignar });
  return tarjetas;
}

/** "la luz", "la renta", "el internet": artículo por la terminación; los conceptos libres van tal cual. */
function articulo(concepto: string): string {
  const c = concepto.trim().toLowerCase();
  if (c === '') return concepto;
  const femenino = /(a|ión|z|d)$/.test(c) && !/^(agua|día|mapa)$/.test(c);
  return `${femenino ? 'la' : 'el'} ${c}`;
}
