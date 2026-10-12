import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ErrorDominio,
  construirCobroPrestamo,
  construirGasto,
  construirIngreso,
  construirPagoPrestamo,
  construirPagoTarjeta,
  construirPrestamoOtorgado,
  construirPrestamoRecibido,
  construirRetiroEfectivo,
  construirTransferencia,
  esFecha,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { idCategoriaDe } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';

const { ocurrencia } = esquema;

const Monto = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
const Fecha = z.string().refine(esFecha, 'fecha inválida');
const Texto = z.string().trim().min(1).max(200);
const Id = z.string().min(1);
const comunes = { monto: Monto, fecha: Fecha.optional(), descripcion: Texto.optional() };

/**
 * Formulario de movimiento (`02 §5`, RF-REG) para los tipos que origina el usuario en M2. Los ids son de
 * cuentas: `origenId` es de donde sale el dinero y `destinoId` a donde llega; un gasto o pago sin método usa
 * la cuenta puente `pasivo:por_asignar` y un ingreso sin destino `activo:por_asignar_entradas` (`06 §5`).
 */
export const EntradaMovimiento = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('gasto'),
    ...comunes,
    categoria: z.string().min(1),
    origenId: Id,
    comercio: Texto.optional(),
  }),
  z.strictObject({ tipo: z.literal('ingreso'), ...comunes, categoria: z.string().min(1), destinoId: Id }),
  z.strictObject({ tipo: z.literal('transferencia'), ...comunes, origenId: Id, destinoId: Id }),
  z.strictObject({ tipo: z.literal('retiro_efectivo'), ...comunes, origenId: Id, destinoId: Id }),
  z.strictObject({ tipo: z.literal('pago_tarjeta'), ...comunes, origenId: Id, destinoId: Id }),
  z.strictObject({ tipo: z.literal('prestamo_otorgado'), ...comunes, personaId: Id, origenId: Id }),
  z.strictObject({ tipo: z.literal('pago_prestamo'), ...comunes, personaId: Id, origenId: Id }),
  z.strictObject({ tipo: z.literal('cobro_prestamo'), ...comunes, personaId: Id, destinoId: Id }),
  z.strictObject({ tipo: z.literal('prestamo_recibido'), ...comunes, personaId: Id, destinoId: Id }),
]);
export type EntradaMovimiento = z.infer<typeof EntradaMovimiento>;

export type OrigenRegistro = 'manual' | 'voz' | 'texto';

export interface MovimientoRegistrado {
  readonly transaccionId: string;
  /** Token de "Deshacer": se pasa tal cual a `deshacer`. */
  readonly deshacer: string;
  readonly fecha: PlainDate;
}

/** Asientos del movimiento con los constructores de `core` (`04 §4`). */
export function construirMovimiento(ctx: Contexto, e: EntradaMovimiento): MovimientoPropuesto {
  switch (e.tipo) {
    case 'gasto':
      return construirGasto({
        categoria: idCategoriaDe(ctx, e.categoria, 'gasto'),
        pago: e.origenId,
        monto: e.monto,
      });
    case 'ingreso':
      return construirIngreso({
        destino: e.destinoId,
        categoria: idCategoriaDe(ctx, e.categoria, 'ingreso'),
        monto: e.monto,
      });
    case 'transferencia':
      return construirTransferencia({ origen: e.origenId, destino: e.destinoId, monto: e.monto });
    case 'retiro_efectivo':
      return construirRetiroEfectivo({ efectivo: e.destinoId, origen: e.origenId, monto: e.monto });
    case 'pago_tarjeta':
      return construirPagoTarjeta({ tarjeta: e.destinoId, origen: e.origenId, monto: e.monto });
    case 'prestamo_otorgado':
      return construirPrestamoOtorgado({ persona: e.personaId, origen: e.origenId, monto: e.monto });
    case 'pago_prestamo':
      return construirPagoPrestamo({ persona: e.personaId, origen: e.origenId, monto: e.monto });
    case 'cobro_prestamo':
      return construirCobroPrestamo({ persona: e.personaId, destino: e.destinoId, monto: e.monto });
    case 'prestamo_recibido':
      return construirPrestamoRecibido({ persona: e.personaId, destino: e.destinoId, monto: e.monto });
  }
}

/**
 * Registra un movimiento con `Libro.registrar` (valida el patrón de cuentas). Devuelve el token de Deshacer.
 * Sin consentimiento no escribe nada (CA-M2-05).
 */
export function registrarMovimiento(
  ctx: Contexto,
  entrada: EntradaMovimiento,
  opciones: { origen?: OrigenRegistro; porRevisar?: boolean } = {},
): MovimientoRegistrado {
  exigirConsentimiento(ctx);
  const r = EntradaMovimiento.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('movimiento_invalido', 'revisa los datos del movimiento');
  const e = r.data;
  const fecha = e.fecha ?? ctx.reloj.hoy();
  const propuesto = construirMovimiento(ctx, e);
  const { transaccion } = ctx.libro.registrar({
    tipo: propuesto.tipo,
    fecha,
    origen: opciones.origen ?? 'manual',
    claveIdempotencia: `mov:${ctx.generarId()}`,
    asientos: propuesto.asientos,
    descripcion: e.descripcion ?? null,
    comercio: e.tipo === 'gasto' ? (e.comercio ?? null) : null,
    porRevisar: opciones.porRevisar ?? false,
  });
  return { transaccionId: transaccion.id, deshacer: transaccion.id, fecha };
}

/**
 * Anula un movimiento (transacción espejo, E2) y devuelve a `pendiente` las ocurrencias que había cubierto
 * (`04 §5`). Es lo que hace "Deshacer" y "Anular" en el detalle.
 */
export function anularMovimiento(ctx: Contexto, transaccionId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    ctx.libro.anular(transaccionId);
    ctx.db
      .update(ocurrencia)
      .set({ estado: 'pendiente', transaccionId: null })
      .where(and(eq(ocurrencia.transaccionId, transaccionId), eq(ocurrencia.estado, 'cubierta')))
      .run();
  });
}

/** "Deshacer" del registro optimista: el token lista las transacciones registradas (separadas por coma). */
export function deshacer(ctx: Contexto, token: string): void {
  enTransaccion(ctx, () => {
    for (const id of token.split(',')) if (id !== '') anularMovimiento(ctx, id);
  });
}
