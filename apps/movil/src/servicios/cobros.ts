import { and, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { ErrorDominio, esFecha, sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { planificarRecordatoriosCobro, PREFIJO_RECORDATORIO_COBRO } from '../avisos/cobros';
import type { HoraDelDia } from '../avisos/planificar';
import { sincronizarAvisos, type PuertoNotificaciones, type ResultadoSincronizacion } from '../avisos/puerto';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { obtenerPreferenciasAvisos } from './avisos-tarjetas';
import { cuentaPorId } from './catalogo';
import type { Contexto } from './contexto';
import { etiquetaDiaMes, etiquetaFecha, pesos } from './formato';
import { listarMovimientos, type MovimientoVista } from './movimientos';
import { borrarAjuste, escribirAjuste, leerAjuste, listarAjustes } from './preferencias';

const { transaccionVigente: tv, asiento } = esquema;

// ——— Datos para cobrar (Ajustes → Datos para cobrar, `02 §17`) ———

/** Dígito de control de la CLABE (pesos 3, 7, 1 sobre los primeros 17 dígitos). */
export function clabeValida(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  const pesosClabe = [3, 7, 1];
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += (Number(clabe[i]) * (pesosClabe[i % 3] as number)) % 10;
  return (10 - (suma % 10)) % 10 === Number(clabe[17]);
}

const DatosCobroGuardados = z
  .strictObject({
    celular: z
      .string()
      .regex(/^\d{10}$/)
      .optional(),
    clabe: z.string().refine(clabeValida).optional(),
  })
  .refine((d) => d.celular !== undefined || d.clabe !== undefined);

/** Celular (para DiMo) y CLABE: viven solo en el teléfono (tabla `ajuste`), nunca salen a la nube. */
export interface DatosCobro {
  readonly celular: string | null;
  readonly clabe: string | null;
}

const CLAVE_DATOS = 'datos_cobro';

export function leerDatosCobro(ctx: Contexto): DatosCobro | null {
  const d = leerAjuste(ctx, CLAVE_DATOS, DatosCobroGuardados);
  return d ? { celular: d.celular ?? null, clabe: d.clabe ?? null } : null;
}

const soloDigitos = (s: string | null | undefined) => (s ?? '').replace(/[\s-]/g, '');

/**
 * Guarda los datos para cobrar (al menos uno). Acepta espacios y guiones. Errores: `celular_invalido` (no son
 * 10 dígitos), `clabe_invalida` (no son 18 dígitos o falla el dígito de control), `datos_cobro_vacios`.
 */
export function guardarDatosCobro(
  ctx: Contexto,
  datos: { celular?: string | null; clabe?: string | null },
): DatosCobro {
  exigirConsentimiento(ctx);
  const celular = soloDigitos(datos.celular);
  const clabe = soloDigitos(datos.clabe);
  if (celular === '' && clabe === '') {
    throw new ErrorDominio('datos_cobro_vacios', 'escribe tu celular o tu CLABE');
  }
  if (celular !== '' && !/^\d{10}$/.test(celular)) {
    throw new ErrorDominio('celular_invalido', 'el celular debe tener 10 dígitos');
  }
  if (clabe !== '' && !clabeValida(clabe)) {
    throw new ErrorDominio('clabe_invalida', 'la CLABE no es válida');
  }
  escribirAjuste(ctx, CLAVE_DATOS, DatosCobroGuardados, {
    ...(celular !== '' ? { celular } : {}),
    ...(clabe !== '' ? { clabe } : {}),
  });
  return { celular: celular || null, clabe: clabe || null };
}

export function borrarDatosCobro(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  borrarAjuste(ctx, CLAVE_DATOS);
}

/** "22 1234 5678". */
export function formatearCelular(celular: string): string {
  return `${celular.slice(0, 2)} ${celular.slice(2, 6)} ${celular.slice(6)}`;
}

/** "0123 4567 8901 2345 68". */
export function formatearClabe(clabe: string): string {
  return clabe.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ——— Mensaje de "Cobrar" (`02 §17`, RF-PER-02) ———

/** "sáb 10 oct". */
function fechaCorta(fecha: PlainDate): string {
  const [dia = ''] = etiquetaFecha(fecha).split(' ');
  return `${dia} ${etiquetaDiaMes(fecha)}`;
}

/** El último cargo vigente a la persona (cuenta dividida o préstamo) y lo que le cargó. */
function ultimoCargo(
  ctx: Contexto,
  personaId: string,
): { monto: Centavos; descripcion: string | null; fecha: PlainDate } | null {
  const fila = ctx.db
    .select({ monto: asiento.monto, descripcion: tv.descripcion, fecha: tv.fecha })
    .from(asiento)
    .innerJoin(tv, eq(tv.id, asiento.transaccionId))
    .where(and(eq(asiento.cuentaId, personaId), gt(asiento.monto, 0)))
    .orderBy(desc(tv.fecha), desc(tv.registradaEn))
    .get();
  return fila ?? null;
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/**
 * Arma el mensaje de cobro: "Hola Caro, te recuerdo los $300 de la cena del sáb 10 oct. Me los puedes mandar a
 * mi celular 22 1234 5678 (DiMo) o a mi CLABE 0123 4567 8901 2345 68. Gracias." El concepto y la fecha salen
 * del último cargo solo si explica todo lo que te debe; si no, "los $450 que me debes". No mueve dinero.
 */
export function armarMensajeCobro(
  datos: DatosCobro,
  persona: { nombre: string; saldo: Centavos },
  cargo: { monto: Centavos; descripcion: string | null; fecha: PlainDate } | null,
): string {
  const concepto =
    cargo && cargo.monto === persona.saldo
      ? `${cargo.descripcion ? ` de ${cargo.descripcion}` : ''} del ${fechaCorta(cargo.fecha)}`
      : ' que me debes';
  const destinos = [
    ...(datos.celular ? [`a mi celular ${formatearCelular(datos.celular)} (DiMo)`] : []),
    ...(datos.clabe ? [`a mi CLABE ${formatearClabe(datos.clabe)}`] : []),
  ].join(' o ');
  return (
    `Hola ${primerNombre(persona.nombre)}, te recuerdo los ${pesos(persona.saldo)}${concepto}. ` +
    `Me los puedes mandar ${destinos}. Gracias.`
  );
}

export type ResultadoCobro =
  | { readonly resultado: 'mensaje'; readonly texto: string }
  /** CA-M8-02: sin datos para cobrar, primero se piden. */
  | { readonly resultado: 'faltan_datos' }
  | { readonly resultado: 'sin_saldo' };

/** "Cobrar" en el detalle de alguien que te debe: el texto para la hoja de compartir. */
export function prepararCobro(ctx: Contexto, personaId: string): ResultadoCobro {
  const persona = personaDe(ctx, personaId);
  const saldo = ctx.libro.saldo(personaId);
  if (saldo <= 0) return { resultado: 'sin_saldo' };
  const datos = leerDatosCobro(ctx);
  if (!datos) return { resultado: 'faltan_datos' };
  return {
    resultado: 'mensaje',
    texto: armarMensajeCobro(datos, { nombre: persona.nombre, saldo }, ultimoCargo(ctx, personaId)),
  };
}

function personaDe(ctx: Contexto, personaId: string) {
  const c = cuentaPorId(ctx, personaId);
  if (c.naturaleza !== 'contraparte' || c.subtipo !== 'persona') {
    throw new ErrorDominio('persona_invalida', 'no es una persona');
  }
  return c;
}

// ——— Recordatorios de cobro (RF-PER-03) ———

const RecordatorioGuardado = z.strictObject({ fecha: z.string().refine(esFecha) });
const PREFIJO_AJUSTE = 'recordatorio_cobro:';

export interface OpcionRecordatorio {
  readonly fecha: PlainDate;
  /** "Mañana", "En 3 días", "En una semana". */
  readonly etiqueta: string;
}

/** Las opciones de "Recuérdame cobrar" a partir de hoy. */
export function opcionesRecordatorioCobro(ctx: Contexto): OpcionRecordatorio[] {
  const hoy = ctx.reloj.hoy();
  return [
    { fecha: sumarDias(hoy, 1), etiqueta: 'Mañana' },
    { fecha: sumarDias(hoy, 3), etiqueta: 'En 3 días' },
    { fecha: sumarDias(hoy, 7), etiqueta: 'En una semana' },
  ];
}

/**
 * Programa (o quita, con `null`) el recordatorio de cobro de una persona que te debe. Uno por persona: uno
 * nuevo reemplaza al anterior. La fecha debe ser posterior a hoy.
 */
export function fijarRecordatorioCobro(ctx: Contexto, personaId: string, fecha: PlainDate | null): void {
  exigirConsentimiento(ctx);
  personaDe(ctx, personaId);
  const clave = `${PREFIJO_AJUSTE}${personaId}`;
  if (fecha === null) return borrarAjuste(ctx, clave);
  if (!esFecha(fecha) || fecha <= ctx.reloj.hoy()) {
    throw new ErrorDominio('fecha_invalida', 'elige un día después de hoy');
  }
  if (ctx.libro.saldo(personaId) <= 0) throw new ErrorDominio('sin_saldo', 'no te debe nada');
  escribirAjuste(ctx, clave, RecordatorioGuardado, { fecha });
}

/** El recordatorio vigente de la persona (`null` si no hay, ya pasó o ya no te debe). */
export function recordatorioCobro(ctx: Contexto, personaId: string): PlainDate | null {
  const r = leerAjuste(ctx, `${PREFIJO_AJUSTE}${personaId}`, RecordatorioGuardado);
  if (!r || r.fecha < ctx.reloj.hoy() || ctx.libro.saldo(personaId) <= 0) return null;
  return r.fecha;
}

/**
 * Deja programados en el teléfono exactamente los recordatorios de cobro vigentes: al abrir la app y después de
 * cada escritura. Si la persona ya te pagó, su aviso se cancela.
 */
export function sincronizarRecordatoriosCobro(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
): Promise<ResultadoSincronizacion> {
  const pref = obtenerPreferenciasAvisos(ctx);
  const recordatorios = listarAjustes(ctx, PREFIJO_AJUSTE, RecordatorioGuardado).map((a) => {
    const personaId = a.clave.slice(PREFIJO_AJUSTE.length);
    return { personaId, fecha: a.valor.fecha, saldo: ctx.libro.saldo(personaId) };
  });
  const plan = planificarRecordatoriosCobro({
    hoy: ctx.reloj.hoy(),
    horaActual,
    recordatorios,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
  });
  return sincronizarAvisos(puerto, plan, PREFIJO_RECORDATORIO_COBRO);
}

// ——— Detalle de una persona (`02 §17`) ———

export interface DetallePersona {
  readonly personaId: string;
  readonly nombre: string;
  /** > 0 te debe, < 0 le debes. */
  readonly saldo: Centavos;
  readonly recordatorio: { readonly fecha: PlainDate; readonly etiqueta: string } | null;
  readonly movimientos: readonly MovimientoVista[];
}

export function detallePersona(ctx: Contexto, personaId: string): DetallePersona {
  const c = personaDe(ctx, personaId);
  const fecha = recordatorioCobro(ctx, personaId);
  return {
    personaId,
    nombre: c.nombre,
    saldo: ctx.libro.saldo(personaId),
    recordatorio: fecha ? { fecha, etiqueta: fechaCorta(fecha) } : null,
    movimientos: listarMovimientos(ctx, { cuentaId: personaId }).flatMap((d) => d.movimientos),
  };
}
