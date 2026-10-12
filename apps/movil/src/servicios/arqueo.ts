/**
 * Arqueo de efectivo (E7, `02 §7`, RF-ARQ-01…03): disparadores, paso 1 con los gastos por asignar de más de
 * 24 h, cifra esperada, propuesta de gastos estimados y confirmación. Nada se registra sin confirmar; los
 * marcados pasan a efectivo **antes** de calcular el hueco (E7-08).
 */
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  arqueo as calcularE7,
  construirAjusteArqueo,
  construirCobroPrestamo,
  construirConciliacion,
  construirIngreso,
  diferenciaDias,
  ErrorDominio,
  sumarDias,
  type AccionArqueo,
  type Centavos,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, idCategoria, type TransaccionNueva } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaEfectivo } from './capturas';
import { cuentaPorId, idCategoriaDe } from './catalogo';
import { liberarOcurrencias } from './cobertura';
import { enTransaccion, type Contexto } from './contexto';
import { etiquetaFecha } from './formato';
import { trasRegistrar } from './formulario';
import { escribirAjuste, leerAjuste } from './preferencias';

const { arqueo, transaccion, transaccionVigente: tv, asiento, cuenta } = esquema;

/** Historial de E7: gastos en efectivo confirmados y no estimados de los últimos 60 días. */
export const DIAS_HISTORIAL_ARQUEO = 60;
/** Paso 1 solo con gastos por asignar de más de 24 h (`02 §7`). */
export const MS_POR_ASIGNAR_ARQUEO = 24 * 60 * 60 * 1000;
/** Disparadores (`02 §7`): ≥ 3 días desde el último con movimientos de efectivo; 48 h después de un retiro. */
export const DIAS_ENTRE_ARQUEOS = 3;
export const MS_TRAS_RETIRO = 48 * 60 * 60 * 1000;
/** Insignia "menos preciso" (`02 §4.2`): efectivo sin arqueo por más de 7 días. */
export const DIAS_MENOS_PRECISO = 7;

export interface GastoPorAsignar {
  readonly transaccionId: string;
  readonly descripcion: string | null;
  readonly monto: Centavos;
  readonly fecha: PlainDate;
  /** "vie 9" */
  readonly etiqueta: string;
}

export interface VistaArqueo {
  readonly cuentaId: string;
  readonly nombre: string;
  /** Saldo contable del efectivo: "Deberías traer $640". */
  readonly saldo: Centavos;
  /** Paso 1: "Antes: ¿pagaste alguno de estos en efectivo?" (vacío = se salta). */
  readonly porAsignar: readonly GastoPorAsignar[];
  readonly ultimo: PlainDate | null;
}

function exigirEfectivo(ctx: Contexto, cuentaId?: string) {
  const fila = cuentaId ? cuentaPorId(ctx, cuentaId) : cuentaEfectivo(ctx);
  if (!fila || fila.subtipo !== 'efectivo') {
    throw new ErrorDominio('sin_efectivo', 'el arqueo es de una cuenta de efectivo');
  }
  return fila;
}

function ultimoArqueo(ctx: Contexto, cuentaId: string) {
  return (
    ctx.db
      .select()
      .from(arqueo)
      .where(eq(arqueo.cuentaId, cuentaId))
      .orderBy(desc(arqueo.realizadoEn), desc(arqueo.id))
      .get() ?? null
  );
}

/** Gastos vigentes en `por_asignar` registrados hace más de 24 h, del más viejo al más nuevo. */
export function gastosPorAsignarParaArqueo(ctx: Contexto): GastoPorAsignar[] {
  const limite = ctx.reloj.ahora() - MS_POR_ASIGNAR_ARQUEO;
  return ctx.db
    .select({
      id: tv.id,
      tipo: tv.tipo,
      fecha: tv.fecha,
      descripcion: tv.descripcion,
      comercio: tv.comercio,
      monto: asiento.monto,
    })
    .from(tv)
    .innerJoin(asiento, eq(asiento.transaccionId, tv.id))
    .where(and(eq(asiento.cuentaId, CUENTAS_SISTEMA.porAsignar), lte(tv.registradaEn, limite)))
    .orderBy(asc(tv.fecha), asc(tv.registradaEn))
    .all()
    .filter((t) => t.tipo === 'gasto' && t.monto < 0)
    .map((t) => ({
      transaccionId: t.id,
      descripcion: t.descripcion ?? t.comercio,
      monto: -t.monto,
      fecha: t.fecha,
      etiqueta: etiquetaFecha(t.fecha),
    }));
}

/** Lo que muestra la pantalla de arqueo al abrir (Cuentas → Efectivo, tarjeta de Hoy o "traigo X"). */
export function prepararArqueo(ctx: Contexto, cuentaId?: string): VistaArqueo {
  const e = exigirEfectivo(ctx, cuentaId);
  return {
    cuentaId: e.id,
    nombre: e.nombre,
    saldo: ctx.libro.saldo(e.id),
    porAsignar: gastosPorAsignarParaArqueo(ctx),
    ultimo: ultimoArqueo(ctx, e.id)?.fecha ?? null,
  };
}

/** Gasto en efectivo confirmado y no estimado de los últimos 60 días, por categoría (entrada de E7). */
function historialEfectivo(ctx: Contexto, cuentaId: string): { categoria: string; monto: Centavos }[] {
  const hoy = ctx.reloj.hoy();
  const transacciones = ctx.db
    .select({ id: tv.id })
    .from(tv)
    .innerJoin(asiento, eq(asiento.transaccionId, tv.id))
    .where(
      and(
        eq(asiento.cuentaId, cuentaId),
        eq(tv.estimada, 0),
        gte(tv.fecha, sumarDias(hoy, -DIAS_HISTORIAL_ARQUEO)),
        lte(tv.fecha, hoy),
      ),
    )
    .all()
    .map((f) => f.id);
  const salida: { categoria: string; monto: Centavos }[] = [];
  for (const id of new Set(transacciones)) {
    const t = ctx.db.select({ tipo: transaccion.tipo }).from(transaccion).where(eq(transaccion.id, id)).get();
    if (t?.tipo !== 'gasto' && t?.tipo !== 'cuenta_dividida') continue;
    const asientos = ctx.db
      .select({ monto: asiento.monto, slug: cuenta.categoriaSlug, naturaleza: cuenta.naturaleza })
      .from(asiento)
      .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
      .where(eq(asiento.transaccionId, id))
      .all();
    for (const a of asientos) {
      if (a.naturaleza === 'gasto' && a.monto > 0 && a.slug)
        salida.push({ categoria: a.slug, monto: a.monto });
    }
  }
  return salida;
}

export interface EntradaArqueo {
  readonly cuentaId?: string;
  /** Lo que la persona dice traer. */
  readonly efectivoReal: Centavos;
  /** Gastos por asignar que marcó como pagados en efectivo (paso 1). */
  readonly marcados?: readonly string[];
}

export interface PropuestaArqueo {
  readonly categoria: string;
  readonly nombre: string;
  readonly monto: Centavos;
}

export interface CalculoArqueo {
  readonly cuentaId: string;
  readonly saldo: Centavos;
  readonly reasignado: Centavos;
  /** "Deberías traer": saldo − marcados (con la coca de $25 marcada, $615). */
  readonly esperado: Centavos;
  readonly efectivoReal: Centavos;
  /** > 0 faltante, < 0 sobrante. */
  readonly hueco: Centavos;
  readonly accion: AccionArqueo;
  /** "Faltan $315. Lo repartí según tus gastos en efectivo:" (editable antes de confirmar). */
  readonly propuesta: readonly PropuestaArqueo[];
}

function montosMarcados(ctx: Contexto, marcados: readonly string[]): Map<string, Centavos> {
  const disponibles = new Map(gastosPorAsignarParaArqueo(ctx).map((g) => [g.transaccionId, g.monto]));
  const salida = new Map<string, Centavos>();
  for (const id of new Set(marcados)) {
    const monto = disponibles.get(id);
    if (monto === undefined) throw new ErrorDominio('marcado_invalido', 'ese gasto ya no está por asignar');
    salida.set(id, monto);
  }
  return salida;
}

function nombreCategoria(ctx: Contexto, slug: string): string {
  return cuentaPorId(ctx, idCategoria(slug)).nombre;
}

/** E7 sin escribir nada: la cifra esperada, el hueco y la propuesta (E7-08 con marcados). */
export function calcularArqueo(ctx: Contexto, entrada: EntradaArqueo): CalculoArqueo {
  const e = exigirEfectivo(ctx, entrada.cuentaId);
  const marcados = montosMarcados(ctx, entrada.marcados ?? []);
  const saldo = ctx.libro.saldo(e.id);
  const r = calcularE7({
    saldo_contable: saldo,
    efectivo_real: entrada.efectivoReal,
    historial: historialEfectivo(ctx, e.id),
    marcados: [...marcados.values()],
  });
  return {
    cuentaId: e.id,
    saldo,
    reasignado: r.reasignado,
    esperado: saldo - r.reasignado,
    efectivoReal: entrada.efectivoReal,
    hueco: r.hueco,
    accion: r.accion,
    propuesta: r.propuesta.map((p) => ({ ...p, nombre: nombreCategoria(ctx, p.categoria) })),
  };
}

/** "Traes $15 más de lo esperado. ¿De dónde salió?" (E7-09). Nunca se registra sin respuesta. */
export type RespuestaSobrante =
  | { readonly tipo: 'me_dieron' }
  | { readonly tipo: 'me_pagaron'; readonly personaId: string }
  | { readonly tipo: 'anote_de_mas' }
  | { readonly tipo: 'no_se' };

export interface ConfirmacionArqueo extends EntradaArqueo {
  /** La lista editada; sin ella, la propuesta de E7. Debe sumar el faltante. */
  readonly propuesta?: readonly { readonly categoria: string; readonly monto: Centavos }[];
  readonly sobrante?: RespuestaSobrante;
}

export interface ArqueoConfirmado {
  readonly arqueoId: string;
  readonly calculo: CalculoArqueo;
  /** El ajuste (faltante) o la respuesta al sobrante; `null` si cuadró. */
  readonly transaccionId: string | null;
}

/**
 * Confirma el arqueo (CA-M5-05) en una transacción SQLite: (1) los marcados se reemplazan con el efectivo como
 * cuenta (conservando lo dictado); (2) un faltante es **una** `ajuste_arqueo` estimada con la propuesta; un
 * sobrante, la respuesta elegida; (3) la fila `arqueo` guarda saldo, reasignado, real y hueco.
 */
export function confirmarArqueo(ctx: Contexto, entrada: ConfirmacionArqueo): ArqueoConfirmado {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const calculo = calcularArqueo(ctx, entrada);
    const efectivo = calculo.cuentaId;
    const arqueoId = ctx.generarId();
    const hoy = ctx.reloj.hoy();

    for (const id of new Set(entrada.marcados ?? [])) {
      const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, id)).get();
      if (!fila) throw new ErrorDominio('marcado_invalido', 'ese gasto ya no está por asignar');
      const asientos = ctx.libro.obtener(id)?.asientos ?? [];
      const nueva: TransaccionNueva = {
        tipo: fila.tipo as TransaccionNueva['tipo'],
        fecha: fila.fecha,
        origen: fila.origen as TransaccionNueva['origen'],
        claveIdempotencia: `arqueo:${arqueoId}:${id}`,
        asientos: asientos.map((a) => ({
          cuentaId: a.cuentaId === CUENTAS_SISTEMA.porAsignar ? efectivo : a.cuentaId,
          monto: a.monto,
        })),
        descripcion: fila.descripcion,
        comercio: fila.comercio,
        estimada: fila.estimada === 1,
        extraordinaria: fila.extraordinaria === 1,
        porRevisar: false,
        meta: fila.meta,
      };
      const r = ctx.libro.reemplazar(id, nueva);
      liberarOcurrencias(ctx, id);
      trasRegistrar(ctx, r.nueva.id);
    }

    let mov: MovimientoPropuesto | null = null;
    if (calculo.hueco > 0) {
      const lista = entrada.propuesta ?? calculo.propuesta;
      const total = lista.reduce((s, p) => s + p.monto, 0);
      if (
        lista.length === 0 ||
        total !== calculo.hueco ||
        lista.some((p) => !Number.isSafeInteger(p.monto) || p.monto <= 0)
      ) {
        throw new ErrorDominio('propuesta_invalida', 'los gastos deben sumar lo que falta');
      }
      mov = construirAjusteArqueo({
        efectivo,
        propuestas: lista.map((p) => ({
          cuentaId: idCategoriaDe(ctx, p.categoria, 'gasto'),
          monto: p.monto,
        })),
      });
    } else if (calculo.hueco < 0) {
      if (!entrada.sobrante) throw new ErrorDominio('falta_respuesta', '¿de dónde salió lo que sobra?');
      const monto = -calculo.hueco;
      switch (entrada.sobrante.tipo) {
        case 'me_dieron':
          mov = construirIngreso({ destino: efectivo, categoria: idCategoria('regalo_recibido'), monto });
          break;
        case 'me_pagaron':
          mov = construirCobroPrestamo({ persona: entrada.sobrante.personaId, destino: efectivo, monto });
          break;
        case 'anote_de_mas':
        case 'no_se':
          mov = construirConciliacion({
            cuenta: efectivo,
            capital: CUENTAS_SISTEMA.ajusteConciliacion,
            saldoLibro: calculo.esperado,
            saldoReal: calculo.efectivoReal,
          });
          break;
      }
    }

    let transaccionId: string | null = null;
    if (mov) {
      transaccionId = ctx.libro.registrar({
        tipo: mov.tipo,
        fecha: hoy,
        origen: 'arqueo',
        claveIdempotencia: `arqueo:${arqueoId}`,
        asientos: mov.asientos,
        estimada: mov.tipo === 'ajuste_arqueo',
        meta: JSON.stringify({ arqueo: arqueoId }),
      }).transaccion.id;
      trasRegistrar(ctx, transaccionId);
    }
    ctx.db
      .insert(arqueo)
      .values({
        id: arqueoId,
        cuentaId: efectivo,
        fecha: hoy,
        realizadoEn: ctx.reloj.ahora(),
        saldoContable: calculo.saldo,
        reasignado: calculo.reasignado,
        efectivoReal: calculo.efectivoReal,
        hueco: calculo.hueco,
        transaccionId,
      })
      .run();
    return { arqueoId, calculo, transaccionId };
  });
}

// ——— Disparadores (`02 §7`) ———

const Pospuesto = z.strictObject({ fecha: z.string() });
const CLAVE_POSPUESTO = 'arqueo_pospuesto';

export interface ArqueoPendiente {
  readonly cuentaId: string;
  readonly nombre: string;
  /** "Deberías traer $640 en efectivo." */
  readonly saldo: Centavos;
  readonly motivo: 'dias' | 'retiro';
  /** Con gastos por asignar viejos el arqueo abre en el paso 1 (no se contesta con un toque). */
  readonly conPorAsignar: boolean;
}

/** Movimientos vigentes del efectivo (sin saldos iniciales) registrados después de `desde` (ms). */
function movimientosEfectivo(ctx: Contexto, cuentaId: string, desde: number) {
  return ctx.db
    .select({ tipo: tv.tipo, fecha: tv.fecha, registradaEn: tv.registradaEn })
    .from(tv)
    .innerJoin(asiento, eq(asiento.transaccionId, tv.id))
    .where(and(eq(asiento.cuentaId, cuentaId), gte(tv.registradaEn, desde)))
    .all()
    .filter((t) => t.tipo !== 'saldo_inicial');
}

/**
 * ¿Toca pedir arqueo? (RF-ARQ-01): 48 h después de un retiro de cajero, o ≥ 3 días desde el último arqueo (o
 * desde el primer movimiento de efectivo) con movimientos de efectivo desde entonces. "Ahora no" lo oculta el
 * resto del día.
 */
export function arqueoPendiente(ctx: Contexto): ArqueoPendiente | null {
  const e = cuentaEfectivo(ctx);
  if (!e) return null;
  const hoy = ctx.reloj.hoy();
  if (leerAjuste(ctx, CLAVE_POSPUESTO, Pospuesto)?.fecha === hoy) return null;
  const ahora = ctx.reloj.ahora();
  const ultimo = ultimoArqueo(ctx, e.id);
  const desde = ultimo ? ultimo.realizadoEn + 1 : 0;
  const movimientos = movimientosEfectivo(ctx, e.id, desde);
  if (movimientos.length === 0) return null;
  const retiro = movimientos.some(
    (t) => t.tipo === 'retiro_efectivo' && ahora - t.registradaEn >= MS_TRAS_RETIRO,
  );
  const referencia = ultimo?.fecha ?? movimientos.map((t) => t.fecha).sort()[0] ?? hoy;
  const porDias = diferenciaDias(referencia, hoy) >= DIAS_ENTRE_ARQUEOS;
  if (!retiro && !porDias) return null;
  return {
    cuentaId: e.id,
    nombre: e.nombre,
    saldo: ctx.libro.saldo(e.id),
    motivo: retiro ? 'retiro' : 'dias',
    conPorAsignar: gastosPorAsignarParaArqueo(ctx).length > 0,
  };
}

/** "Ahora no": la tarjeta de arqueo vuelve mañana. */
export function posponerArqueo(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, CLAVE_POSPUESTO, Pospuesto, { fecha: ctx.reloj.hoy() });
}

/** Insignia "menos preciso" (`02 §4.2`): efectivo sin arqueo por más de 7 días. */
export function efectivoMenosPreciso(ctx: Contexto): boolean {
  const e = cuentaEfectivo(ctx);
  if (!e) return false;
  const ultimo = ultimoArqueo(ctx, e.id);
  let referencia: PlainDate | null = ultimo?.fecha ?? null;
  if (referencia === null) {
    const inicial = ctx.db
      .select({ fecha: tv.fecha })
      .from(tv)
      .innerJoin(asiento, eq(asiento.transaccionId, tv.id))
      .where(and(eq(asiento.cuentaId, e.id), eq(tv.tipo, 'saldo_inicial')))
      .get();
    referencia = inicial?.fecha ?? null;
  }
  return referencia !== null && diferenciaDias(referencia, ctx.reloj.hoy()) > DIAS_MENOS_PRECISO;
}
