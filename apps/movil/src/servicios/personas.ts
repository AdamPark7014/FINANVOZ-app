import { and, asc, eq } from 'drizzle-orm';
import { ErrorDominio, type Centavos } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, insertarCuenta, normalizarAliases } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { registrarMovimiento, type MovimientoRegistrado, type OrigenRegistro } from './formulario';

const { contacto, aliasContacto, cuenta, auditoria } = esquema;

export interface Persona {
  readonly cuentaId: string;
  readonly contactoId: string | null;
  readonly nombre: string;
  /** Con el signo de la persona: > 0 te debe, < 0 le debes. */
  readonly saldo: Centavos;
  /** "Apartar lo que le debo" (`02 §11`); encendido por defecto. */
  readonly apartar: boolean;
}

/** Crea el contacto y su cuenta `contraparte:persona` (`04 §2`). */
export function crearPersona(ctx: Contexto, datos: { nombre: string; alias?: readonly string[] }): string {
  exigirConsentimiento(ctx);
  const nombre = datos.nombre.trim();
  if (nombre === '' || nombre.length > 80) throw new ErrorDominio('persona_invalida', 'falta el nombre');
  return enTransaccion(ctx, () => {
    const contactoId = ctx.generarId();
    ctx.db.insert(contacto).values({ id: contactoId, nombre, creadoEn: ctx.reloj.ahora() }).run();
    const alias = normalizarAliases([nombre, ...(datos.alias ?? [])]);
    if (alias.length > 0) {
      ctx.db
        .insert(aliasContacto)
        .values(alias.map((a) => ({ contactoId, aliasNormalizado: a })))
        .run();
    }
    return insertarCuenta(ctx, { naturaleza: 'contraparte', subtipo: 'persona', nombre, contactoId });
  });
}

export function listarPersonas(ctx: Contexto): Persona[] {
  return ctx.db
    .select()
    .from(cuenta)
    .where(and(eq(cuenta.naturaleza, 'contraparte'), eq(cuenta.subtipo, 'persona'), eq(cuenta.archivada, 0)))
    .orderBy(asc(cuenta.nombre))
    .all()
    .map((c) => ({
      cuentaId: c.id,
      contactoId: c.contactoId,
      nombre: c.nombre,
      saldo: ctx.libro.saldo(c.id),
      apartar: c.apartarDeuda === 1,
    }));
}

/**
 * Interruptor "Apartar lo que le debo" (E4: `deudas_personas[].apartar`). No es financiero: cambia
 * `cuenta.apartar_deuda` y deja registro en `auditoria`.
 */
export function fijarApartarDeuda(ctx: Contexto, personaCuentaId: string, apartar: boolean): void {
  exigirConsentimiento(ctx);
  const c = cuentaPorId(ctx, personaCuentaId);
  if (c.naturaleza !== 'contraparte' || c.subtipo === 'tanda') {
    throw new ErrorDominio('persona_invalida', 'solo aplica a deudas con personas');
  }
  const nuevo = apartar ? 1 : 0;
  if (c.apartarDeuda === nuevo) return;
  enTransaccion(ctx, () => {
    ctx.db.update(cuenta).set({ apartarDeuda: nuevo }).where(eq(cuenta.id, c.id)).run();
    ctx.db
      .insert(auditoria)
      .values({
        id: ctx.generarId(),
        en: ctx.reloj.ahora(),
        entidad: 'cuenta',
        entidadId: c.id,
        accion: 'apartar_deuda',
        antes: JSON.stringify({ apartar_deuda: c.apartarDeuda }),
        despues: JSON.stringify({ apartar_deuda: nuevo }),
      })
      .run();
  });
}

type TipoPrestamo = 'prestamo_recibido' | 'prestamo_otorgado' | 'pago_prestamo' | 'cobro_prestamo';

/**
 * Préstamos con personas (`04 §4` casos 7a–7d). `cuentaId` es la cuenta propia: a donde llega en un préstamo
 * recibido o un cobro, de donde sale en un préstamo otorgado o un pago.
 */
export function registrarPrestamo(
  ctx: Contexto,
  e: {
    tipo: TipoPrestamo;
    personaId: string;
    cuentaId: string;
    monto: Centavos;
    fecha?: string;
    descripcion?: string;
  },
  origen: OrigenRegistro = 'manual',
): MovimientoRegistrado {
  const comunes = {
    monto: e.monto,
    personaId: e.personaId,
    ...(e.fecha ? { fecha: e.fecha } : {}),
    ...(e.descripcion ? { descripcion: e.descripcion } : {}),
  };
  const entrada =
    e.tipo === 'prestamo_recibido' || e.tipo === 'cobro_prestamo'
      ? { tipo: e.tipo, ...comunes, destinoId: e.cuentaId }
      : { tipo: e.tipo, ...comunes, origenId: e.cuentaId };
  return registrarMovimiento(ctx, entrada, { origen });
}
