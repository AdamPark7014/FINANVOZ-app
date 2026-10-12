import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  elegirOcurrencia,
  ErrorDominio,
  normalizarComercio,
  similitud,
  type Centavos,
  type MovimientoCobertura,
  type OcurrenciaCobertura,
  type PlainDate,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { enTransaccion, type Contexto } from './contexto';
import { borrarAjuste, escribirAjuste, leerAjuste, listarAjustes } from './preferencias';

const { ocurrencia, programado, transaccion, asiento, cuenta } = esquema;

/** Similitud de comercios de E9.2 sobre comercios normalizados con E9.1 (decisión de M1). */
export const similitudComercios = (a: string, b: string): number =>
  similitud(normalizarComercio(a), normalizarComercio(b));

/** Las ocurrencias que cubría una transacción anulada o reemplazada vuelven a `pendiente` (`04 §5`). */
export function liberarOcurrencias(ctx: Contexto, transaccionId: string): void {
  ctx.db
    .update(ocurrencia)
    .set({ estado: 'pendiente', transaccionId: null })
    .where(and(eq(ocurrencia.transaccionId, transaccionId), eq(ocurrencia.estado, 'cubierta')))
    .run();
}

/** Resultado de la cobertura automática de un movimiento (E3.5). */
export type CoberturaAutomatica =
  | {
      readonly decision: 'cubierta';
      readonly programadoId: string;
      readonly fecha: PlainDate;
      readonly concepto: string;
    }
  | {
      /** Monto distinto en un pago fijo: Hoy pregunta "¿Este pago fue tu renta?". */
      readonly decision: 'preguntar';
      readonly programadoId: string;
      readonly fecha: PlainDate;
      readonly concepto: string;
      readonly montoProgramado: Centavos;
      readonly montoMovimiento: Centavos;
    };

interface Candidato {
  readonly tipo: 'ingreso' | 'egreso';
  readonly movimiento: MovimientoCobertura;
}

/**
 * "Qué movimientos cuentan" (E3.5): para una ocurrencia de ingreso, un `ingreso` que llegó a una cuenta real
 * (una entrada por asignar no está en tu dinero: no mueve el horizonte, regla 12); para una de egreso, un
 * `gasto`, una `cuenta_dividida` (con lo que salió de tu cuenta), un `pago_tarjeta` (su "categoría" es la tarjeta
 * que recibe el pago, `04 §5`) o una `aportacion_tanda`. Transferencias, préstamos, cobros y compras a meses no
 * cubren nada.
 */
function candidato(ctx: Contexto, transaccionId: string): Candidato | null {
  const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, transaccionId)).get();
  if (!fila || fila.tipo === 'reversa') return null;
  const asientos = ctx.db
    .select({
      cuentaId: asiento.cuentaId,
      monto: asiento.monto,
      naturaleza: cuenta.naturaleza,
      espacio: cuenta.espacio,
    })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(eq(asiento.transaccionId, transaccionId))
    .all();
  if (asientos.some((a) => a.espacio !== 'personal')) return null;
  const comercio = fila.comercio ?? fila.descripcion ?? null;
  switch (fila.tipo) {
    case 'ingreso': {
      const destino = asientos.find((a) => a.monto > 0 && a.naturaleza !== 'ingreso');
      if (!destino || destino.cuentaId === CUENTAS_SISTEMA.porAsignarEntradas) return null;
      return {
        tipo: 'ingreso',
        movimiento: { sentido: 'entrada', fecha: fila.fecha, monto: destino.monto, cuenta: destino.cuentaId },
      };
    }
    case 'gasto':
    case 'cuenta_dividida': {
      const sale = asientos.find((a) => a.monto < 0);
      const categoria = asientos.find((a) => a.naturaleza === 'gasto' && a.monto > 0);
      if (!sale) return null;
      return {
        tipo: 'egreso',
        movimiento: {
          sentido: 'salida',
          fecha: fila.fecha,
          monto: -sale.monto,
          cuenta: sale.cuentaId,
          categoria: categoria?.cuentaId ?? null,
          comercio,
        },
      };
    }
    case 'pago_tarjeta':
    case 'aportacion_tanda': {
      const sale = asientos.find((a) => a.monto < 0);
      const recibe = asientos.find((a) => a.monto > 0);
      if (!sale || !recibe) return null;
      return {
        tipo: 'egreso',
        movimiento: {
          sentido: 'salida',
          fecha: fila.fecha,
          monto: -sale.monto,
          cuenta: sale.cuentaId,
          categoria: recibe.cuentaId,
          comercio,
        },
      };
    }
    default:
      return null;
  }
}

const PreguntaCobertura = z.strictObject({ transaccion_id: z.string(), monto_movimiento: z.int() });
const PREFIJO = 'cobertura_pendiente:';
const clavePregunta = (programadoId: string, fecha: PlainDate) => `${PREFIJO}${programadoId}:${fecha}`;

/**
 * Cobertura **automática** de ocurrencias (E3.5, `04 §5`, CA-M4-05 y CA-M4-11): compara el movimiento con las
 * ocurrencias pendientes de los programados activos del espacio personal. `cubrir` → la ocurrencia queda
 * cubierta por esa transacción (y E4 deja de reservarla; un ingreso mueve el horizonte); `preguntar` → se guarda
 * la pregunta para Hoy; `no` → nada. Una transacción cubre a lo más una ocurrencia. Idempotente.
 */
export function cubrirAutomaticamente(ctx: Contexto, transaccionId: string): CoberturaAutomatica | null {
  const c = candidato(ctx, transaccionId);
  if (!c) return null;
  const yaCubre = ctx.db
    .select({ id: ocurrencia.programadoId })
    .from(ocurrencia)
    .where(eq(ocurrencia.transaccionId, transaccionId))
    .get();
  if (yaCubre) return null;
  const pendientes = ctx.db
    .select({ o: ocurrencia, p: programado })
    .from(ocurrencia)
    .innerJoin(programado, eq(programado.id, ocurrencia.programadoId))
    .where(
      and(
        eq(ocurrencia.estado, 'pendiente'),
        eq(programado.activo, 1),
        eq(programado.espacio, 'personal'),
        eq(programado.tipo, c.tipo),
      ),
    )
    .all();
  const ocurrencias: OcurrenciaCobertura[] = pendientes.map(({ o, p }) =>
    p.tipo === 'ingreso'
      ? { tipo: 'ingreso', fecha: o.fecha, monto: p.monto, cuenta: p.cuentaId }
      : {
          tipo: 'egreso',
          fecha: o.fecha,
          monto: p.monto,
          cuenta: p.cuentaId,
          // Pago planeado de tarjeta: su "categoría" es la tarjeta (`04 §5`).
          categoria: p.tarjetaId ?? p.categoriaCuentaId,
          // Sin comercio guardado, el concepto ("Netflix") sirve de comercio.
          comercio: p.comercioNormalizado ?? p.concepto,
          variable: p.variable === 1,
        },
  );
  const elegida = elegirOcurrencia(ocurrencias, c.movimiento, similitudComercios);
  if (!elegida) return null;
  const { o, p } = pendientes[elegida.indice] as (typeof pendientes)[number];
  if (elegida.decision === 'cubrir') {
    ctx.db
      .update(ocurrencia)
      .set({ estado: 'cubierta', transaccionId })
      .where(and(eq(ocurrencia.programadoId, o.programadoId), eq(ocurrencia.fecha, o.fecha)))
      .run();
    return { decision: 'cubierta', programadoId: p.id, fecha: o.fecha, concepto: p.concepto };
  }
  escribirAjuste(ctx, clavePregunta(p.id, o.fecha), PreguntaCobertura, {
    transaccion_id: transaccionId,
    monto_movimiento: c.movimiento.monto,
  });
  return {
    decision: 'preguntar',
    programadoId: p.id,
    fecha: o.fecha,
    concepto: p.concepto,
    montoProgramado: p.monto,
    montoMovimiento: c.movimiento.monto,
  };
}

/**
 * Para una entrada capturada (`07 §5`, `transferencia_recibida` (b)): el programado de ingreso pendiente que
 * E3.5 cubriría con esa entrada (`cubrir`), o `null`. No escribe nada: la captura registra el `ingreso` con la
 * categoría del programado y después la cobertura automática lo marca.
 */
export function ingresoQueCubriria(
  ctx: Contexto,
  movimiento: { fecha: PlainDate; monto: Centavos; cuenta: string },
): { programadoId: string; categoriaCuentaId: string | null } | null {
  const pendientes = ctx.db
    .select({ o: ocurrencia, p: programado })
    .from(ocurrencia)
    .innerJoin(programado, eq(programado.id, ocurrencia.programadoId))
    .where(
      and(
        eq(ocurrencia.estado, 'pendiente'),
        eq(programado.activo, 1),
        eq(programado.espacio, 'personal'),
        eq(programado.tipo, 'ingreso'),
      ),
    )
    .all();
  const elegida = elegirOcurrencia(
    pendientes.map(({ o, p }) => ({ tipo: 'ingreso', fecha: o.fecha, monto: p.monto, cuenta: p.cuentaId })),
    { sentido: 'entrada', ...movimiento },
    similitudComercios,
  );
  if (elegida?.decision !== 'cubrir') return null;
  const { p } = pendientes[elegida.indice] as (typeof pendientes)[number];
  return { programadoId: p.id, categoriaCuentaId: p.categoriaCuentaId };
}

/** Pregunta de cobertura pendiente (tarjeta de Hoy "¿Este pago de $4,700 fue tu renta?"). */
export interface PreguntaCoberturaVista {
  readonly programadoId: string;
  readonly fecha: PlainDate;
  readonly transaccionId: string;
  readonly concepto: string;
  readonly montoProgramado: Centavos;
  readonly montoMovimiento: Centavos;
}

function vigente(ctx: Contexto, id: string): boolean {
  const t = ctx.db.select({ tipo: transaccion.tipo }).from(transaccion).where(eq(transaccion.id, id)).get();
  if (!t || t.tipo === 'reversa') return false;
  return !ctx.db.select({ id: transaccion.id }).from(transaccion).where(eq(transaccion.revierteA, id)).get();
}

/** Preguntas de cobertura que siguen aplicando (ocurrencia pendiente y movimiento vigente), por fecha. */
export function preguntasCoberturaPendientes(ctx: Contexto): PreguntaCoberturaVista[] {
  const salida: PreguntaCoberturaVista[] = [];
  for (const { clave, valor } of listarAjustes(ctx, PREFIJO, PreguntaCobertura)) {
    const [programadoId = '', fecha = ''] = clave.slice(PREFIJO.length).split(/:(?=\d{4}-\d{2}-\d{2}$)/);
    const fila = ctx.db
      .select({ o: ocurrencia, p: programado })
      .from(ocurrencia)
      .innerJoin(programado, eq(programado.id, ocurrencia.programadoId))
      .where(and(eq(ocurrencia.programadoId, programadoId), eq(ocurrencia.fecha, fecha)))
      .get();
    if (
      !fila ||
      fila.o.estado !== 'pendiente' ||
      fila.p.activo !== 1 ||
      !vigente(ctx, valor.transaccion_id)
    ) {
      continue;
    }
    salida.push({
      programadoId,
      fecha,
      transaccionId: valor.transaccion_id,
      concepto: fila.p.concepto,
      montoProgramado: fila.p.monto,
      montoMovimiento: valor.monto_movimiento,
    });
  }
  return salida.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** "Sí": la ocurrencia queda cubierta por ese movimiento (E4 deja de reservarla). */
export function confirmarCobertura(ctx: Contexto, ref: { programadoId: string; fecha: PlainDate }): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const clave = clavePregunta(ref.programadoId, ref.fecha);
    const p = leerAjuste(ctx, clave, PreguntaCobertura);
    if (!p) throw new ErrorDominio('pregunta_inexistente', 'esa pregunta ya se contestó');
    const o = ctx.db
      .select()
      .from(ocurrencia)
      .where(and(eq(ocurrencia.programadoId, ref.programadoId), eq(ocurrencia.fecha, ref.fecha)))
      .get();
    if (o?.estado === 'pendiente' && vigente(ctx, p.transaccion_id)) {
      ctx.db
        .update(ocurrencia)
        .set({ estado: 'cubierta', transaccionId: p.transaccion_id })
        .where(and(eq(ocurrencia.programadoId, ref.programadoId), eq(ocurrencia.fecha, ref.fecha)))
        .run();
    }
    borrarAjuste(ctx, clave);
  });
}

/** "No": el pago no era ese compromiso; la ocurrencia sigue pendiente y reservada. */
export function rechazarCobertura(ctx: Contexto, ref: { programadoId: string; fecha: PlainDate }): void {
  exigirConsentimiento(ctx);
  borrarAjuste(ctx, clavePregunta(ref.programadoId, ref.fecha));
}
