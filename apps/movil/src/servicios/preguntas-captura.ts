/**
 * Lo que la persona ve y contesta de las capturas (`02 §6`): "Por revisar", "¿Fue a meses?", "¿A quién le
 * mandaste $X?", "¿De dónde salió el pago?", tarjeta nueva detectada, "¿Es el mismo movimiento?" y el contador
 * de no reconocidas por banco (RF-CAP-06). Las cifras son centavos; la UI arma el texto con su formato.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  construirGasto,
  construirIngreso,
  construirPagoTarjeta,
  construirPrestamoOtorgado,
  construirPrestamoRecibido,
  construirTransferencia,
  ErrorDominio,
  type CatalogoPlantillas,
  type Centavos,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, idCategoria } from '@cartera/datos';
import { nombreBanco } from '../captura/catalogo';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, idCategoriaDe } from './catalogo';
import {
  avanzar,
  capturasEn,
  internos,
  leerCaptura,
  marcarRevisada,
  MOTIVOS_REVISAR,
  VENTANA_PAREJA_MS,
  vigenteDe,
  type CapturaLeida,
  type MotivoRevisar,
} from './capturas';
import { liberarOcurrencias } from './cobertura';
import { enTransaccion, type Contexto } from './contexto';
import { aplicarCorreccion } from './correcciones';
import { trasRegistrar } from './formulario';
import { pasarAMeses, type PasadoAMeses } from './msi';
import { agregarCuenta } from './onboarding';

const { transaccion, cuenta } = esquema;

const Meta = z.looseObject({
  revisar: z.array(z.enum(MOTIVOS_REVISAR)).optional(),
  sin_categoria: z.boolean().optional(),
});

function metaDe(ctx: Contexto, transaccionId: string) {
  const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, transaccionId)).get();
  if (!fila) return null;
  const meta = Meta.safeParse(fila.meta ? JSON.parse(fila.meta) : {});
  return { fila, meta: meta.success ? meta.data : {} };
}

function nombreCuenta(ctx: Contexto, id: string | undefined): string | null {
  if (id === undefined) return null;
  return ctx.db.select({ nombre: cuenta.nombre }).from(cuenta).where(eq(cuenta.id, id)).get()?.nombre ?? null;
}

// ——— Por revisar ———

export type MotivoPorRevisar = MotivoRevisar | 'no_reconocida';

/** Una captura en "Por revisar" (Movimientos → filtro "Por revisar", `02 §6`). */
export interface CapturaPorRevisar {
  readonly capturaId: string;
  /** El primero decide la acción principal; puede haber dos ("sin categoría" y "¿Fue a meses?"). */
  readonly motivos: readonly MotivoPorRevisar[];
  readonly transaccionId: string | null;
  readonly fecha: PlainDate;
  readonly monto: Centavos | null;
  readonly cuenta: string | null;
  readonly comercio: string | null;
  /** Slug de la categoría actual; `null` si la captura no la trae (la tarjeta pregunta). */
  readonly categoria: string | null;
  readonly banco: string;
  /** Solo las no reconocidas muestran su texto (guardado en el teléfono 30 días, RF-CAP-06). */
  readonly texto: { readonly titulo: string | null; readonly texto: string | null } | null;
}

/**
 * "Por revisar" de las capturas, en orden de llegada: movimientos capturados vigentes con `por_revisar` y no
 * reconocidas que nadie ha atendido.
 */
export function listarCapturasPorRevisar(ctx: Contexto, catalogo: CatalogoPlantillas): CapturaPorRevisar[] {
  const salida: CapturaPorRevisar[] = [];
  const vistos = new Set<string>();
  for (const c of capturasEn(ctx, ['vinculada', 'no_reconocida'])) {
    const banco = nombreBanco(catalogo, c.datos.banco);
    if (c.estado === 'no_reconocida') {
      if (c.datos.revisada) continue;
      salida.push({
        capturaId: c.id,
        motivos: ['no_reconocida'],
        transaccionId: null,
        fecha: c.datos.fecha,
        monto: null,
        cuenta: null,
        comercio: null,
        categoria: null,
        banco,
        texto: c.texto,
      });
      continue;
    }
    const tx = vigenteDe(ctx, c.transaccionId);
    if (tx === null || vistos.has(tx)) continue;
    const leida = metaDe(ctx, tx);
    if (!leida || leida.fila.porRevisar !== 1) continue;
    vistos.add(tx);
    const asientos = internos.asientosDe(ctx, tx);
    const categoria = asientos.find((a) => a.c.naturaleza === 'gasto' || a.c.naturaleza === 'ingreso');
    const motivos: MotivoPorRevisar[] = leida.meta.revisar?.length ? [...leida.meta.revisar] : ['ingreso'];
    salida.push({
      capturaId: c.id,
      motivos,
      transaccionId: tx,
      fecha: leida.fila.fecha,
      monto: asientos.reduce((s, a) => s + Math.max(0, a.monto), 0),
      cuenta: nombreCuenta(ctx, c.datos.cuenta_id),
      comercio: leida.fila.comercio ?? c.datos.comercio ?? null,
      categoria: leida.meta.sin_categoria ? null : (categoria?.c.categoriaSlug ?? null),
      banco,
      texto: null,
    });
  }
  return salida;
}

function transaccionPorRevisar(ctx: Contexto, capturaId: string): string {
  const c = leerCaptura(ctx, capturaId);
  const tx = vigenteDe(ctx, c.transaccionId);
  if (tx === null) throw new ErrorDominio('captura_sin_movimiento', 'ese movimiento ya no está');
  return tx;
}

/** "¿Fue a meses?" → elegir meses convierte el cargo en compra a meses (pasar a meses, `05 §E6.2`). */
export function fueAMeses(ctx: Contexto, capturaId: string, meses: number): PasadoAMeses {
  return pasarAMeses(ctx, transaccionPorRevisar(ctx, capturaId), meses);
}

/**
 * "Confirmar" en Por revisar: con `categoria` distinta corrige el movimiento y aprende la regla del comercio
 * (`06 §12`); sin cambios solo lo saca de la lista. "No fue a meses" es lo mismo sin categoría.
 */
export function confirmarCaptura(ctx: Contexto, capturaId: string, categoria?: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const tx = transaccionPorRevisar(ctx, capturaId);
    const actual = internos
      .asientosDe(ctx, tx)
      .find((a) => a.c.naturaleza === 'gasto' || a.c.naturaleza === 'ingreso');
    const leida = metaDe(ctx, tx);
    const sinCategoria = leida?.meta.sin_categoria === true;
    if (categoria !== undefined && (categoria !== actual?.c.categoriaSlug || sinCategoria)) {
      aplicarCorreccion(ctx, tx, { categoria });
    } else {
      marcarRevisada(ctx, tx);
    }
  });
}

/** Una no reconocida atendida ("Ya la registré" o "Descartar"): sale de Por revisar y sigue en el contador. */
export function marcarNoReconocidaRevisada(ctx: Contexto, capturaId: string): void {
  exigirConsentimiento(ctx);
  const c = leerCaptura(ctx, capturaId);
  if (c.estado !== 'no_reconocida')
    throw new ErrorDominio('captura_invalida', 'esa captura no es de revisar');
  internos.guardar(ctx, c.id, { estado: 'no_reconocida', datos: { ...c.datos, revisada: true } });
}

/** RF-CAP-06: cuántas no reconocidas hubo por banco (solo el conteo puede salir, con analítica autorizada). */
export function noReconocidasPorBanco(ctx: Contexto): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const c of capturasEn(ctx, ['no_reconocida'])) {
    const banco = c.datos.banco ?? 'desconocido';
    conteo[banco] = (conteo[banco] ?? 0) + 1;
  }
  return conteo;
}

/** Transacciones vigentes que salieron de capturas (las dos mitades de un par cuentan una vez). */
export function transaccionesDesdeCapturas(ctx: Contexto): string[] {
  const ids = new Set<string>();
  for (const c of capturasEn(ctx, ['vinculada'])) {
    const v = vigenteDe(ctx, c.transaccionId);
    if (v) ids.add(v);
  }
  return [...ids];
}

// ——— Preguntas (tarjetas de acción de Hoy) ———

export interface CuentaOpcion {
  readonly id: string;
  readonly nombre: string;
}

export interface MitadCandidata {
  readonly capturaId: string;
  readonly cuenta: string;
  readonly fecha: PlainDate;
}

export type PreguntaCaptura =
  | {
      /** "¿A quién le mandaste $X?" (E9.4, caso 18). */
      readonly tipo: 'salida_sin_pareja';
      readonly capturaId: string;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly cuenta: string;
      /** Entradas sin pareja del mismo monto ("A otra cuenta mía"). */
      readonly entradas: readonly MitadCandidata[];
    }
  | {
      /** "¿De dónde salió el pago de $4,200 a tu Oro?" (caso 19). */
      readonly tipo: 'pago_sin_origen';
      readonly capturaId: string;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly tarjeta: string;
      readonly salidas: readonly MitadCandidata[];
    }
  | {
      /** "Detecté una tarjeta ••4321 de Banco A. ¿La agrego?" o, sin últimos 4, "¿En qué cuenta fue?". */
      readonly tipo: 'cuenta_nueva';
      readonly capturaId: string;
      readonly banco: string;
      readonly bancoId: string | null;
      readonly ultimos4: string | null;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      /** Cuentas que podrían ser (elegir una la asocia a ese banco). */
      readonly candidatas: readonly CuentaOpcion[];
      /** Un cargo con tarjeta: el formulario por omisión es el de tarjeta de crédito. */
      readonly sugerencia: 'tarjeta_credito' | 'cuenta';
    }
  | {
      /** E9.3 `preguntar`: "¿Es lo mismo que «Coca» del vie 9?". */
      readonly tipo: 'duplicado';
      readonly capturaId: string;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly dictado: {
        readonly descripcion: string | null;
        readonly monto: Centavos;
        readonly fecha: PlainDate;
        readonly tipo: string;
      };
    }
  | {
      /** RF-CAP-08: cargo capturado en tarjeta de crédito de $1,000 o más. */
      readonly tipo: 'fue_a_meses';
      readonly capturaId: string;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly comercio: string | null;
      readonly tarjeta: string;
    };

function sinParejaVencida(ctx: Contexto, c: CapturaLeida): boolean {
  return (
    c.datos.pareja === undefined &&
    ctx.reloj.ahora() - c.datos.cuando > VENTANA_PAREJA_MS &&
    vigenteDe(ctx, c.transaccionId) !== null &&
    tipoVigente(ctx, c) === 'transferencia_pendiente'
  );
}

function tipoVigente(ctx: Contexto, c: CapturaLeida): string | null {
  const v = vigenteDe(ctx, c.transaccionId);
  if (!v) return null;
  return (
    ctx.db.select({ tipo: transaccion.tipo }).from(transaccion).where(eq(transaccion.id, v)).get()?.tipo ??
    null
  );
}

function mitades(ctx: Contexto, c: CapturaLeida, lado: 'salida' | 'entrada'): MitadCandidata[] {
  const tipos =
    lado === 'salida' ? ['transferencia_enviada'] : ['transferencia_recibida', 'pago_recibido_tarjeta'];
  return capturasEn(ctx, ['vinculada'])
    .filter(
      (o) =>
        o.id !== c.id &&
        tipos.includes(o.datos.tipo) &&
        o.datos.pareja === undefined &&
        o.datos.monto === c.datos.monto &&
        o.datos.cuenta_id !== c.datos.cuenta_id &&
        vigenteDe(ctx, o.transaccionId) !== null,
    )
    .map((o) => ({
      capturaId: o.id,
      cuenta: nombreCuenta(ctx, o.datos.cuenta_id) ?? '',
      fecha: o.datos.fecha,
    }));
}

/** Preguntas de captura pendientes, en orden de llegada (`02 §4.1` prioridad 5). */
export function preguntasCaptura(ctx: Contexto, catalogo: CatalogoPlantillas): PreguntaCaptura[] {
  const salida: PreguntaCaptura[] = [];
  for (const c of capturasEn(ctx, ['interpretada', 'vinculada'])) {
    const d = c.datos;
    if (c.estado === 'interpretada' && d.espera?.tipo === 'cuenta') {
      salida.push({
        tipo: 'cuenta_nueva',
        capturaId: c.id,
        banco: nombreBanco(catalogo, d.banco),
        bancoId: d.banco,
        ultimos4: d.ultimos4 ?? null,
        monto: d.monto ?? 0,
        fecha: d.fecha,
        candidatas: d.espera.candidatas.map((id) => ({ id, nombre: nombreCuenta(ctx, id) ?? '' })),
        sugerencia: d.tipo === 'cargo' && d.ultimos4 !== undefined ? 'tarjeta_credito' : 'cuenta',
      });
    } else if (c.estado === 'interpretada' && d.espera?.tipo === 'duplicado') {
      const v = vigenteDe(ctx, d.espera.transaccion_id);
      const fila = v ? ctx.db.select().from(transaccion).where(eq(transaccion.id, v)).get() : undefined;
      if (!v || !fila) continue;
      const monto = internos.asientosDe(ctx, v).reduce((s, a) => s + Math.max(0, a.monto), 0);
      salida.push({
        tipo: 'duplicado',
        capturaId: c.id,
        monto: d.monto ?? 0,
        fecha: d.fecha,
        dictado: {
          descripcion: fila.descripcion ?? fila.comercio,
          monto,
          fecha: fila.fecha,
          tipo: fila.tipo,
        },
      });
    } else if (c.estado === 'vinculada' && sinParejaVencida(ctx, c)) {
      if (d.tipo === 'transferencia_enviada') {
        salida.push({
          tipo: 'salida_sin_pareja',
          capturaId: c.id,
          monto: d.monto ?? 0,
          fecha: d.fecha,
          cuenta: nombreCuenta(ctx, d.cuenta_id) ?? '',
          entradas: mitades(ctx, c, 'entrada'),
        });
      } else if (d.tipo === 'pago_recibido_tarjeta') {
        salida.push({
          tipo: 'pago_sin_origen',
          capturaId: c.id,
          monto: d.monto ?? 0,
          fecha: d.fecha,
          tarjeta: nombreCuenta(ctx, d.cuenta_id) ?? '',
          salidas: mitades(ctx, c, 'salida'),
        });
      }
    }
  }
  for (const p of listarCapturasPorRevisar(ctx, catalogo)) {
    if (!p.motivos.includes('fue_a_meses') || p.monto === null) continue;
    salida.push({
      tipo: 'fue_a_meses',
      capturaId: p.capturaId,
      monto: p.monto,
      fecha: p.fecha,
      comercio: p.comercio,
      tarjeta: p.cuenta ?? '',
    });
  }
  return salida;
}

// ——— Respuestas ———

/** Respuestas a "¿A quién le mandaste $X?" (`02 §6`, caso 18). */
export type RespuestaSalida =
  | { readonly destino: 'entrada'; readonly capturaId: string }
  | { readonly destino: 'cuenta'; readonly cuentaId: string }
  | { readonly destino: 'externa' }
  | { readonly destino: 'prestamo'; readonly personaId: string }
  | { readonly destino: 'gasto'; readonly categoria: string }
  | { readonly destino: 'otro' };

/** Respuestas a "¿De dónde salió el pago?" (`02 §6`, caso 19). */
export type RespuestaPago =
  | { readonly origen: 'salida'; readonly capturaId: string }
  | { readonly origen: 'cuenta'; readonly cuentaId: string }
  | { readonly origen: 'externa' }
  | { readonly origen: 'persona'; readonly personaId: string }
  | { readonly origen: 'regalo' };

function exigirPendiente(ctx: Contexto, capturaId: string, tipo: string): { c: CapturaLeida; tx: string } {
  const c = leerCaptura(ctx, capturaId);
  const tx = vigenteDe(ctx, c.transaccionId);
  if (c.datos.tipo !== tipo || c.datos.pareja !== undefined || tx === null) {
    throw new ErrorDominio('pregunta_inexistente', 'esa pregunta ya se contestó');
  }
  return { c, tx };
}

function reemplazarPendiente(
  ctx: Contexto,
  c: CapturaLeida,
  tx: string,
  mov: MovimientoPropuesto,
  extra: { porRevisar?: boolean; meta?: Record<string, unknown> } = {},
): string {
  const r = ctx.libro.reemplazar(tx, {
    tipo: mov.tipo,
    fecha: c.datos.fecha,
    origen: 'notificacion',
    claveIdempotencia: `captura:${c.id}:respuesta`,
    asientos: mov.asientos,
    porRevisar: extra.porRevisar ?? false,
    meta: JSON.stringify({ captura: c.id, ...(extra.meta ?? {}) }),
  });
  liberarOcurrencias(ctx, tx);
  internos.guardar(ctx, c.id, {
    estado: 'vinculada',
    datos: { ...c.datos, pareja: 'respondida' },
    transaccionId: r.nueva.id,
  });
  trasRegistrar(ctx, r.nueva.id);
  return r.nueva.id;
}

/**
 * Contesta la salida sin pareja (CA-M5-09): reemplaza el `transferencia_pendiente` del caso 15 por los asientos
 * del caso 18 según la respuesta. "A otra cuenta mía" con una entrada capturada forma el par de E9.4.
 */
export function responderSalidaSinPareja(ctx: Contexto, capturaId: string, r: RespuestaSalida): string {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const { c, tx } = exigirPendiente(ctx, capturaId, 'transferencia_enviada');
    const origen = c.datos.cuenta_id as string;
    const monto = c.datos.monto as Centavos;
    switch (r.destino) {
      case 'entrada': {
        const entrada = leerCaptura(ctx, r.capturaId);
        const otra = vigenteDe(ctx, entrada.transaccionId);
        if (entrada.datos.pareja !== undefined || entrada.datos.monto !== monto || otra === null) {
          throw new ErrorDominio('pareja_invalida', 'esa entrada no corresponde');
        }
        return internos.aplicarPar(ctx, c, entrada, [tx, otra]);
      }
      case 'cuenta': {
        const destino = cuentaPorId(ctx, r.cuentaId);
        const mov =
          destino.subtipo === 'tarjeta_credito'
            ? construirPagoTarjeta({ tarjeta: destino.id, origen, monto })
            : construirTransferencia({ origen, destino: destino.id, monto });
        return reemplazarPendiente(ctx, c, tx, mov);
      }
      case 'externa':
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirTransferencia({ origen, destino: CUENTAS_SISTEMA.cuentasExternas, monto }),
        );
      case 'prestamo':
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirPrestamoOtorgado({ persona: r.personaId, origen, monto }),
        );
      case 'gasto':
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirGasto({ categoria: idCategoriaDe(ctx, r.categoria, 'gasto'), pago: origen, monto }),
        );
      case 'otro':
        // Salió dinero y no sabemos a dónde: un gasto por revisar (nunca vuelve a tu dinero libre, regla 12).
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirGasto({ categoria: idCategoria('otros_gastos'), pago: origen, monto }),
          { porRevisar: true, meta: { revisar: ['pregunta_24h'], sin_categoria: true } },
        );
    }
  });
}

/** Contesta el pago a tarjeta sin salida (caso 19). */
export function responderPagoSinOrigen(ctx: Contexto, capturaId: string, r: RespuestaPago): string {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const { c, tx } = exigirPendiente(ctx, capturaId, 'pago_recibido_tarjeta');
    const tarjeta = c.datos.cuenta_id as string;
    const monto = c.datos.monto as Centavos;
    switch (r.origen) {
      case 'salida': {
        const salida = leerCaptura(ctx, r.capturaId);
        const otra = vigenteDe(ctx, salida.transaccionId);
        if (salida.datos.pareja !== undefined || salida.datos.monto !== monto || otra === null) {
          throw new ErrorDominio('pareja_invalida', 'esa salida no corresponde');
        }
        return internos.aplicarPar(ctx, salida, c, [otra, tx]);
      }
      case 'cuenta':
        return reemplazarPendiente(ctx, c, tx, construirPagoTarjeta({ tarjeta, origen: r.cuentaId, monto }));
      case 'externa':
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirPagoTarjeta({ tarjeta, origen: CUENTAS_SISTEMA.cuentasExternas, monto }),
        );
      case 'persona':
        // "Alguien más la pagó" y se lo debes.
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirPrestamoRecibido({ persona: r.personaId, destino: tarjeta, monto }),
        );
      case 'regalo':
        return reemplazarPendiente(
          ctx,
          c,
          tx,
          construirIngreso({ destino: tarjeta, categoria: idCategoria('regalo_recibido'), monto }),
        );
    }
  });
}

/**
 * Asocia la captura en espera con una cuenta (elegida o recién creada desde "Tarjeta nueva detectada"). La
 * cuenta aprende su banco (y sus últimos 4 si no los tenía) y se reprocesan las demás capturas de ese banco que
 * esperaban cuenta.
 */
export function asociarCuentaCaptura(ctx: Contexto, capturaId: string, cuentaId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const c = leerCaptura(ctx, capturaId);
    if (c.estado !== 'interpretada' || c.datos.espera?.tipo !== 'cuenta') {
      throw new ErrorDominio('pregunta_inexistente', 'esa captura ya tiene cuenta');
    }
    const fila = cuentaPorId(ctx, cuentaId);
    const cambios: { institucion?: string; ultimos4?: string } = {};
    if (fila.institucion === null && c.datos.banco !== null) cambios.institucion = c.datos.banco;
    if (fila.ultimos4 === null && c.datos.ultimos4 !== undefined) {
      const ocupado = ctx.db
        .select({ id: cuenta.id })
        .from(cuenta)
        .where(and(eq(cuenta.ultimos4, c.datos.ultimos4), eq(cuenta.archivada, 0)))
        .get();
      if (!ocupado) cambios.ultimos4 = c.datos.ultimos4;
    }
    if (Object.keys(cambios).length > 0)
      ctx.db.update(cuenta).set(cambios).where(eq(cuenta.id, cuentaId)).run();
    const { espera: _espera, ...datos } = c.datos;
    void _espera;
    internos.guardar(ctx, c.id, { estado: 'interpretada', datos: { ...datos, cuenta_id: cuentaId } });
    avanzar(ctx, c.id);
    // Las demás que esperaban cuenta del mismo banco vuelven a intentar el paso 1.
    for (const otra of capturasEn(ctx, ['interpretada'])) {
      if (otra.datos.espera?.tipo !== 'cuenta' || otra.datos.banco !== c.datos.banco) continue;
      const { espera: _e, ...resto } = otra.datos;
      void _e;
      internos.guardar(ctx, otra.id, { estado: 'interpretada', datos: resto });
      avanzar(ctx, otra.id);
    }
  });
}

/**
 * "Detecté una cuenta ••4321 de Banco A. ¿La agrego?" con el saldo de hoy (`02 §6`): el saldo que la persona ve
 * en su app ya incluye los movimientos que estaban esperando cuenta, así que el saldo inicial los descuenta para
 * no contarlos dos veces (un depósito contado dos veces inflaría el dinero libre, regla 12). Después se asocia.
 */
export function agregarCuentaDesdeCaptura(
  ctx: Contexto,
  capturaId: string,
  entrada: { nombre: string; saldoHoy: Centavos },
): string {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const c = leerCaptura(ctx, capturaId);
    if (c.estado !== 'interpretada' || c.datos.espera?.tipo !== 'cuenta') {
      throw new ErrorDominio('pregunta_inexistente', 'esa captura ya tiene cuenta');
    }
    let efecto = 0;
    for (const o of capturasEn(ctx, ['interpretada'])) {
      if (o.datos.espera?.tipo !== 'cuenta' || o.datos.banco !== c.datos.banco) continue;
      if (o.datos.ultimos4 !== c.datos.ultimos4) continue;
      const sentido = internos.sentidoDe(o.datos.tipo);
      const monto = o.datos.monto ?? 0;
      efecto += sentido === 'entrada' ? monto : sentido === 'salida' ? -monto : 0;
    }
    const cuentaId = agregarCuenta(ctx, {
      subtipo: 'debito',
      nombre: entrada.nombre,
      saldo: Math.max(0, entrada.saldoHoy - efecto),
      ...(c.datos.ultimos4 !== undefined ? { ultimos4: c.datos.ultimos4 } : {}),
    });
    asociarCuentaCaptura(ctx, capturaId, cuentaId);
    return cuentaId;
  });
}

/** "No es mía" en una captura en espera: queda descartada sin movimiento. */
export function descartarCaptura(ctx: Contexto, capturaId: string): void {
  exigirConsentimiento(ctx);
  const c = leerCaptura(ctx, capturaId);
  if (c.estado !== 'interpretada')
    throw new ErrorDominio('pregunta_inexistente', 'esa captura ya se atendió');
  internos.guardar(ctx, c.id, { estado: 'descartada', datos: c.datos });
}

/** "¿Es el mismo movimiento?" (E9.3): "Sí" fusiona con lo dictado; "No" lo registra aparte. */
export function responderDuplicado(ctx: Contexto, capturaId: string, respuesta: 'mismo' | 'otro'): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const c = leerCaptura(ctx, capturaId);
    if (c.estado !== 'interpretada' || c.datos.espera?.tipo !== 'duplicado') {
      throw new ErrorDominio('pregunta_inexistente', 'esa pregunta ya se contestó');
    }
    const { espera, ...datos } = c.datos;
    internos.guardar(ctx, c.id, {
      estado: 'interpretada',
      datos: {
        ...datos,
        duplicado: respuesta,
        ...(respuesta === 'mismo' ? { dictado: espera.transaccion_id } : {}),
      },
    });
    avanzar(ctx, c.id);
  });
}

/** Capturas que siguen esperando (cuenta o respuesta), para contadores. */
export function contarCapturasEnEspera(ctx: Contexto): number {
  return ctx.db
    .select({ id: esquema.captura.id })
    .from(esquema.captura)
    .where(and(eq(esquema.captura.estado, 'interpretada'), isNull(esquema.captura.transaccionId)))
    .all().length;
}
