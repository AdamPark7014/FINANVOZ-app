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
import { z } from 'zod';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { esIngresoVariable, obtenerColchon } from './ajustes';
import { catalogoApp } from '../captura/catalogo';
import { procesarApertura } from './apertura';
import { arqueoPendiente, efectivoMenosPreciso, type ArqueoPendiente } from './arqueo';
import { avisosPendientes, type Aviso } from './avisos';
import { preguntasCoberturaPendientes } from './cobertura';
import { capturaInactiva, reactivarCapturaPendiente } from './estado-captura';
import { listarCapturasPorRevisar, preguntasCaptura, type PreguntaCaptura } from './preguntas-captura';
import type { Contexto } from './contexto';
import { dias as textoDias, etiquetaFecha, pesos } from './formato';
import { preguntasLiquidarPendientes, type PlanPorLiquidar } from './msi';
import { listarOcurrencias, pospuestaHoy } from './ocurrencias';
import { escribirAjuste, leerAjuste } from './preferencias';
import { contarPorInterpretar } from './registrar';
import { ingresoPrincipal } from './programados';
import { programadosDeTandas, tarjetasTanda, type TarjetaTanda } from './tandas';
import { listarAumentosSuscripcionPendientes } from './suscripciones';
import { cuotasMsiPendientes, tarjetasActivas } from './tarjetas';
import { pagosQueVencen, tarjetaDelDia, type TarjetaDelDia } from './vista-tarjetas';

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
      /** 1. Pago de tarjeta que vence en ≤ 3 días (o ya venció) con PNGI pendiente. */
      readonly tipo: 'pago_tarjeta';
      readonly tarjetaId: string;
      readonly nombre: string;
      readonly corte: PlainDate;
      readonly limite: PlainDate;
      /** "jue 30" */
      readonly etiquetaFecha: string;
      /** Pago para no generar intereses (E5.3). */
      readonly pngi: Centavos;
      readonly cuando: 'por_vencer' | 'vencido';
      /** "Tu Banamex Oro ••8812 vence el jue 30." */
      readonly texto: string;
      /** "Ya la pagué" → `pagarTarjeta` (pide la cuenta); "Todavía no" → `todaviaNoPagoTarjeta`. */
      readonly opciones: readonly ['ya_la_pague', 'todavia_no'];
    }
  | {
      /** 5. Un pago con monto distinto al de un pago fijo (E3.5 `preguntar`). */
      readonly tipo: 'confirmar_cobertura';
      readonly programadoId: string;
      readonly fecha: PlainDate;
      readonly etiquetaFecha: string;
      readonly transaccionId: string;
      readonly concepto: string;
      readonly montoProgramado: Centavos;
      readonly montoMovimiento: Centavos;
      /** "¿Este pago fue la renta?" */
      readonly pregunta: string;
      /** "Sí" → `confirmarCobertura`; "No" → `rechazarCobertura`. */
      readonly opciones: readonly ['si', 'no'];
    }
  | {
      /** 5. Suscripción en compromiso con aumento de precio (E14): confirmar antes de reservar el monto nuevo. */
      readonly tipo: 'aumento_suscripcion';
      readonly comercio: string;
      readonly nombre: string;
      readonly montoNuevo: Centavos;
      readonly montoReservado: Centavos;
      readonly programadoId: string;
      readonly pregunta: string;
      /** "Sí" → `aceptarAumentoSuscripcion`; "No" → `mantenerMontoSuscripcion`. */
      readonly opciones: readonly ['si', 'no'];
    }
  | {
      /** 5. "¿Este pago fue para liquidar tus meses?" (`02 §8`, CA-M4-10). */
      readonly tipo: 'liquidar_msi';
      readonly tarjetaId: string;
      readonly tarjeta: string;
      readonly saldoAFavor: Centavos;
      readonly pregunta: string;
      /** Un chip por plan ("Sí, la tele" → `liquidarMsi(planId)`) y "No" (`noEraParaLiquidar`). */
      readonly planes: readonly PlanPorLiquidar[];
    }
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
  | ({
      /** 4. Arqueo pendiente: "Deberías traer $640 en efectivo. ¿Cuánto traes?" (`02 §7`). */
      readonly tipo: 'arqueo';
      /** "$640" (exacto, un toque) u "Otra cantidad" (abre el arqueo); con por asignar viejos, abre el paso 1. */
      readonly opciones: readonly ['exacto', 'otra_cantidad', 'ahora_no'];
    } & ArqueoPendiente)
  | {
      /** 5. Tras restaurar un respaldo: "Vuelve a activar la lectura de notificaciones" (pendiente 47). */
      readonly tipo: 'reactivar_captura';
    }
  | {
      /** 5. RF-CAP-07: "No he visto notificaciones de tu banco en 3 días." */
      readonly tipo: 'captura_inactiva';
    }
  | {
      /** 5. Preguntas de captura (`02 §6`): salida sin pareja, pago sin origen, ¿Fue a meses?, cuenta nueva… */
      readonly tipo: 'pregunta_captura';
      readonly pregunta: PreguntaCaptura;
    }
  | { readonly tipo: 'por_interpretar'; readonly cantidad: number }
  /** 6. Capturas por revisar (Movimientos → "Por revisar"). */
  | { readonly tipo: 'capturas_por_revisar'; readonly cantidad: number }
  | { readonly tipo: 'por_asignar'; readonly monto: Centavos }
  /** 2. Tandas (`02 §18`): "¿Ya diste tu tanda?" el día que toca y "Me tocó la tanda" en tu turno. */
  | TarjetaTanda;

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
  /** Tarjeta del día (RF-HOY-04, Plus en la UI): `null` con menos de 2 tarjetas elegibles. */
  readonly tarjetaDelDia: TarjetaDelDia | null;
  /** Insignia "menos preciso": efectivo sin arqueo por más de 7 días (`02 §4.2`); tocarla abre el arqueo. */
  readonly efectivoMenosPreciso: boolean;
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
  procesarApertura(ctx);
  const {
    hoy,
    ingreso,
    variable,
    h,
    pendientes,
    compromisos,
    tarjetas,
    pagosPlaneados,
    cuotas,
    deudas,
    l,
    colchon,
    r,
  } = calcularLibre(ctx);

  // Mismo criterio de E4 para listar lo reservado.
  const finEf = maxFecha(h.fin_efectivo, sumarDias(hoy, 1));
  const nombreTarjeta = new Map(tarjetas.map((t) => [t.cuentaId, t.nombre]));
  const conPlan = (id: string, modo: 'totalero' | 'plan') =>
    modo === 'plan' && (pagosPlaneados.get(id)?.length ?? 0) > 0;
  const reservadoDetalle: ConceptoReservado[] = [
    ...tarjetas
      .filter((t) => t.saldoRevolvente > 0 && !conPlan(t.cuentaId, t.modo))
      .map((t) => ({ tipo: 'tarjeta' as const, concepto: t.nombre, monto: t.saldoRevolvente, fecha: null })),
    ...tarjetas
      .filter((t) => conPlan(t.cuentaId, t.modo))
      .flatMap((t) =>
        (pagosPlaneados.get(t.cuentaId) ?? [])
          .filter((p) => p.fecha < finEf)
          .map((p) => ({ tipo: 'tarjeta' as const, concepto: t.nombre, monto: p.monto, fecha: p.fecha })),
      ),
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

  return armarVistaHoy(ctx, { hoy, ingreso, variable, h, pendientes, l, colchon, r, reservadoDetalle });
}

/**
 * E3.3 + E4 sin efectos (quien llama ya corrió `procesarApertura`): horizonte con las ocurrencias de ingreso ya
 * recibidas y dinero libre con L, colchón, compromisos pendientes (incluidos los vencidos), tarjetas, cuotas MSI
 * y deudas con personas. Lo usan Hoy y el simulador (E8: `E₀ = libre`).
 */
export function calcularLibre(ctx: Contexto) {
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
  // RF-TAR-06: los pagos planeados (pendientes) de cada tarjeta en modo plan con programados activos.
  const pagosPlaneados = new Map<string, { fecha: PlainDate; monto: Centavos }[]>();
  for (const o of pendientes) {
    if (o.tipo !== 'egreso' || o.tarjetaId === null) continue;
    pagosPlaneados.set(o.tarjetaId, [
      ...(pagosPlaneados.get(o.tarjetaId) ?? []),
      { fecha: o.fecha, monto: o.monto },
    ]);
  }
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
    // En plan con pagos planeados: E4 reserva los del horizonte; sin ellos, la deuda completa (E4-08).
    tarjetas: tarjetas.map((t) => {
      const pagos = t.modo === 'plan' ? pagosPlaneados.get(t.cuentaId) : undefined;
      return {
        id: t.cuentaId,
        modo: t.modo,
        saldo_revolvente: t.saldoRevolvente,
        ...(pagos ? { pagos_planeados: pagos } : {}),
      };
    }),
    cuotas_msi_no_facturadas: cuotas.map((c) => ({ plan: c.planId, fecha_limite: c.limite, monto: c.monto })),
    deudas_personas: deudas.map((d) => ({ contraparte: d.id, monto: d.monto, apartar: d.apartar })),
  });

  return {
    hoy,
    ingreso,
    variable,
    recibidas,
    h,
    pendientes,
    compromisos,
    tarjetas,
    pagosPlaneados,
    cuotas,
    deudas,
    l,
    colchon,
    r,
  };
}

export type CalculoLibre = ReturnType<typeof calcularLibre>;

function armarVistaHoy(
  ctx: Contexto,
  d: Pick<CalculoLibre, 'hoy' | 'ingreso' | 'variable' | 'h' | 'pendientes' | 'l' | 'colchon' | 'r'> & {
    reservadoDetalle: ConceptoReservado[];
  },
): VistaHoy {
  const { hoy, ingreso, variable, h, pendientes, l, colchon, r, reservadoDetalle } = d;

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
    tarjetaDelDia: tarjetaDelDia(ctx),
    efectivoMenosPreciso: efectivoMenosPreciso(ctx),
  };
}

function tarjetasDeAccion(
  ctx: Contexto,
  hoy: PlainDate,
  pendientes: ReturnType<typeof listarOcurrencias>,
  ingresoId: string | null,
): TarjetaAccion[] {
  const tarjetas: TarjetaAccion[] = [];
  // 1. Pago de tarjeta que vence en ≤ 3 días (con PNGI pendiente del último corte).
  for (const v of pagosQueVencen(ctx)) {
    if (pagoPospuestoHoy(ctx, v.tarjetaId, v.corte)) continue;
    const etiqueta = etiquetaFecha(v.limite);
    tarjetas.push({
      tipo: 'pago_tarjeta',
      tarjetaId: v.tarjetaId,
      nombre: v.nombre,
      corte: v.corte,
      limite: v.limite,
      etiquetaFecha: etiqueta,
      pngi: v.pngi,
      cuando: v.cuando,
      texto:
        v.cuando === 'vencido'
          ? `La fecha límite de tu ${v.nombre} fue el ${etiqueta}.`
          : v.limite === hoy
            ? `Hoy es la fecha límite de tu ${v.nombre}.`
            : `Tu ${v.nombre} vence el ${etiqueta}.`,
      opciones: ['ya_la_pague', 'todavia_no'],
    });
  }
  // 2. Compromiso vencido sin cubrir; las aportaciones de una tanda llevan su propia tarjeta.
  const deTandas = programadosDeTandas(ctx);
  for (const o of pendientes) {
    if (o.tipo !== 'egreso' || o.fecha >= hoy || pospuestaHoy(ctx, o) || deTandas.has(o.programadoId))
      continue;
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
  tarjetas.push(...tarjetasTanda(ctx, pendientes));
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
  // 4. Arqueo pendiente (`02 §7`).
  const arqueo = arqueoPendiente(ctx);
  if (arqueo) tarjetas.push({ tipo: 'arqueo', ...arqueo, opciones: ['exacto', 'otra_cantidad', 'ahora_no'] });
  // 5. Preguntas: reactivar la captura tras restaurar, captura inactiva y de captura (`02 §6`), cobertura con
  // monto distinto (E3.5) y liquidar meses (E6.2).
  if (reactivarCapturaPendiente(ctx)) tarjetas.push({ tipo: 'reactivar_captura' });
  if (capturaInactiva(ctx)) tarjetas.push({ tipo: 'captura_inactiva' });
  const catalogo = catalogoApp();
  for (const pregunta of preguntasCaptura(ctx, catalogo))
    tarjetas.push({ tipo: 'pregunta_captura', pregunta });
  for (const a of listarAumentosSuscripcionPendientes(ctx)) {
    tarjetas.push({
      tipo: 'aumento_suscripcion',
      comercio: a.comercio,
      nombre: a.nombre,
      montoNuevo: a.montoNuevo,
      montoReservado: a.montoReservado,
      programadoId: a.programadoId,
      pregunta: `${a.nombre} ahora cobra ${pesos(a.montoNuevo)} (antes apartaba ${pesos(a.montoReservado)}). ¿Actualizo lo que aparto?`,
      opciones: ['si', 'no'],
    });
  }
  for (const q of preguntasCoberturaPendientes(ctx)) {
    tarjetas.push({
      tipo: 'confirmar_cobertura',
      programadoId: q.programadoId,
      fecha: q.fecha,
      etiquetaFecha: etiquetaFecha(q.fecha),
      transaccionId: q.transaccionId,
      concepto: q.concepto,
      montoProgramado: q.montoProgramado,
      montoMovimiento: q.montoMovimiento,
      pregunta: `¿Este pago fue ${articulo(q.concepto)}?`,
      opciones: ['si', 'no'],
    });
  }
  for (const q of preguntasLiquidarPendientes(ctx)) {
    tarjetas.push({
      tipo: 'liquidar_msi',
      tarjetaId: q.tarjetaId,
      tarjeta: q.tarjeta,
      saldoAFavor: q.saldoAFavor,
      pregunta: q.pregunta,
      planes: q.planes,
    });
  }
  // 6. Frases por interpretar ("Por revisar").
  const cantidad = contarPorInterpretar(ctx);
  if (cantidad > 0) tarjetas.push({ tipo: 'por_interpretar', cantidad });
  const porRevisar = listarCapturasPorRevisar(ctx, catalogo).filter(
    (c) => !c.motivos.includes('fue_a_meses'),
  );
  if (porRevisar.length > 0) tarjetas.push({ tipo: 'capturas_por_revisar', cantidad: porRevisar.length });
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

const PagoPospuesto = z.strictObject({ fecha: z.string() });
const clavePagoPospuesto = (tarjetaId: string, corte: PlainDate) => `pospuesta_tarjeta:${tarjetaId}:${corte}`;

function pagoPospuestoHoy(ctx: Contexto, tarjetaId: string, corte: PlainDate): boolean {
  return leerAjuste(ctx, clavePagoPospuesto(tarjetaId, corte), PagoPospuesto)?.fecha === ctx.reloj.hoy();
}

/** "Todavía no" en el pago de tarjeta que vence: se oculta el resto del día y vuelve a salir mañana. */
export function todaviaNoPagoTarjeta(ctx: Contexto, e: { tarjetaId: string; corte: PlainDate }): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, clavePagoPospuesto(e.tarjetaId, e.corte), PagoPospuesto, { fecha: ctx.reloj.hoy() });
}
