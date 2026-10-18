import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { ErrorDominio, esFecha, sumarDias, type PlainDate, type Regla } from '@cartera/core';
import { esquema, idCategoria } from '@cartera/datos';
import { ReglaRecurrente } from '@cartera/nlu';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { completarOnboarding, fijarColchon } from './ajustes';
import { insertarCuenta } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { registrarSaldoInicial } from './onboarding';
import { crearPersona } from './personas';
import { registrarMovimiento } from './formulario';
import { insertarProgramado } from './programados';

const { cuenta, tarjeta, ocurrencia } = esquema;

const Fecha = z.string().refine(esFecha, 'fecha inválida');

const CuentaEscenario = z.object({
  clave: z.string(),
  subtipo: z.enum(['efectivo', 'debito', 'billetera', 'ahorro', 'tarjeta_credito']),
  nombre: z.string(),
  saldo: z.int(),
  alias: z.array(z.string()).default([]),
  ultimos4: z.string().optional(),
  institucion: z.string().optional(),
  tarjeta: z
    .object({
      dia_corte: z.int(),
      dia_limite_pago: z.int().optional(),
      dias_para_pagar: z.int().optional(),
      limite_credito: z.int(),
      modo: z.enum(['totalero', 'plan']),
    })
    .optional(),
});

/** Formato de `fixtures/escenarios/*.json` (`fixtures/README.md`), solo espacio personal (M2). */
export const Escenario = z.looseObject({
  id: z.string(),
  hoy: Fecha,
  colchon: z.int().min(0).default(0),
  ingreso: z
    .object({
      concepto: z.string(),
      monto: z.int().min(1),
      regla: ReglaRecurrente,
      cuenta: z.string().optional(),
      ultimo_recibido: Fecha.optional(),
    })
    .optional(),
  cuentas: z.array(CuentaEscenario).default([]),
  contactos: z
    .array(
      z.object({
        clave: z.string(),
        nombre: z.string(),
        alias: z.array(z.string()).default([]),
        te_debe: z.int().optional(),
      }),
    )
    .default([]),
  compromisos_unicos: z
    .array(
      z.object({ concepto: z.string(), fecha: Fecha, monto: z.int().min(1), cuenta: z.string().optional() }),
    )
    .default([]),
  /** Gastos con comercio del vector E14 (`e14-01`); categoría `suscripciones`, salvo OXXO en `antojos`. */
  gastos_e14: z
    .object({
      cuenta: z.string().default('efectivo'),
      gastos: z.array(
        z.object({ fecha: Fecha, monto: z.int().min(1), comercio: z.string().min(1) }),
      ),
    })
    .optional(),
  /** Catálogo semilla de E14 en builds de desarrollo (vacío = comportamiento de E14-01). */
  catalogo_suscripciones: z.array(z.string()).optional(),
  espacios: z.unknown().optional(),
  esperado: z.unknown().optional(),
});
export type Escenario = z.infer<typeof Escenario>;

export interface EscenarioCargado {
  readonly id: string;
  /** El reloj de la app se fija en esta fecha (solo builds de desarrollo). */
  readonly hoy: PlainDate;
  /** Clave del archivo → id de la cuenta creada. */
  readonly cuentas: Readonly<Record<string, string>>;
  readonly contactos: Readonly<Record<string, string>>;
  readonly ingresoId: string | null;
  readonly esperado: unknown;
  /** Si viene en el escenario, fijar en el contexto antes de abrir Suscripciones (E14-01 usa `[]`). */
  readonly catalogoSuscripciones?: readonly string[];
}

function registrarGastosE14Semilla(
  ctx: Contexto,
  gastos: readonly { fecha: string; monto: number; comercio: string }[],
  origenId: string,
): void {
  for (const g of gastos) {
    registrarMovimiento(ctx, {
      tipo: 'gasto',
      fecha: g.fecha,
      monto: g.monto,
      comercio: g.comercio,
      categoria: g.comercio.startsWith('OXXO') ? 'antojos' : 'suscripciones',
      origenId,
    });
  }
}

/**
 * Cargador de escenarios semilla (`fixtures/README.md`, solo builds de desarrollo): cuentas con alias y
 * `saldo_inicial` en `hoy − 1`, tarjetas (saldo = deuda), contactos (`te_debe`), ingreso con
 * `define_horizonte = 1` y su `ultimo_recibido` cubierto, compromisos únicos, `gastos_e14` (M10) y colchón.
 * Exige una base sin
 * datos del usuario. El espacio negocio (`e-negocio`) llega con M11.
 */
export function cargarEscenario(ctx: Contexto, datos: unknown): EscenarioCargado {
  const r = Escenario.safeParse(datos);
  if (!r.success) throw new ErrorDominio('escenario_invalido', 'el escenario no tiene el formato esperado');
  const e = r.data;
  if (e.espacios !== undefined) {
    throw new ErrorDominio('escenario_no_soportado', 'los escenarios con negocio llegan con M11');
  }
  const conDatos = ctx.db
    .select({ id: cuenta.id })
    .from(cuenta)
    .where(and(eq(cuenta.sistema, 0), ne(cuenta.naturaleza, 'gasto'), ne(cuenta.naturaleza, 'ingreso')))
    .get();
  if (conDatos) throw new ErrorDominio('base_no_vacia', 'el escenario se carga sobre una base nueva');

  const ayer = sumarDias(e.hoy, -1);
  return enTransaccion(ctx, () => {
    aceptarConsentimiento(ctx, { datosFinancieros: true, medio: 'semilla' });
    const cuentas: Record<string, string> = {};
    for (const c of e.cuentas) {
      const esTarjeta = c.subtipo === 'tarjeta_credito';
      const id = insertarCuenta(ctx, {
        naturaleza: esTarjeta ? 'pasivo' : 'activo',
        subtipo: c.subtipo,
        nombre: c.nombre,
        liquida: esTarjeta || c.subtipo === 'ahorro' ? 0 : 1,
        ultimos4: c.ultimos4 ?? null,
        institucion: c.institucion ?? null,
        alias: [c.nombre, ...c.alias],
      });
      if (esTarjeta) {
        if (!c.tarjeta) throw new ErrorDominio('escenario_invalido', 'tarjeta sin ciclo');
        ctx.db
          .insert(tarjeta)
          .values({
            cuentaId: id,
            diaCorte: c.tarjeta.dia_corte,
            diaLimitePago: c.tarjeta.dia_limite_pago ?? null,
            diasParaPagar: c.tarjeta.dias_para_pagar ?? null,
            limiteCredito: c.tarjeta.limite_credito,
            modo: c.tarjeta.modo,
            alta: ayer,
          })
          .run();
      }
      registrarSaldoInicial(ctx, id, esTarjeta ? -c.saldo : c.saldo, ayer);
      cuentas[c.clave] = id;
    }
    const cuentaDe = (clave: string | undefined): string | null => {
      if (clave === undefined) return null;
      const id = cuentas[clave];
      if (!id) throw new ErrorDominio('escenario_invalido', `cuenta desconocida: ${clave}`);
      return id;
    };

    const contactos: Record<string, string> = {};
    for (const p of e.contactos) {
      const id = crearPersona(ctx, { nombre: p.nombre, alias: p.alias });
      if (p.te_debe) registrarSaldoInicial(ctx, id, p.te_debe, ayer);
      contactos[p.clave] = id;
    }

    let ingresoId: string | null = null;
    if (e.ingreso) {
      ingresoId = insertarProgramado(ctx, {
        tipo: 'ingreso',
        concepto: e.ingreso.concepto,
        monto: e.ingreso.monto,
        regla: e.ingreso.regla as Regla,
        desde: e.ingreso.ultimo_recibido ?? e.hoy,
        cuentaId: cuentaDe(e.ingreso.cuenta),
        categoriaCuentaId: idCategoria('sueldo'),
        defineHorizonte: true,
      });
      if (e.ingreso.ultimo_recibido) {
        ctx.db
          .insert(ocurrencia)
          .values({ programadoId: ingresoId, fecha: e.ingreso.ultimo_recibido, estado: 'cubierta' })
          .run();
      }
    }
    for (const c of e.compromisos_unicos) {
      insertarProgramado(ctx, {
        tipo: 'egreso',
        concepto: c.concepto,
        monto: c.monto,
        regla: { tipo: 'unica', fecha: c.fecha },
        desde: c.fecha < ayer ? c.fecha : ayer,
        cuentaId: cuentaDe(c.cuenta),
      });
    }
    if (e.gastos_e14) {
      const origen = cuentaDe(e.gastos_e14.cuenta);
      if (!origen) throw new ErrorDominio('escenario_invalido', 'gastos_e14 sin cuenta de origen');
      registrarGastosE14Semilla(ctx, e.gastos_e14.gastos, origen);
    }
    fijarColchon(ctx, e.colchon);
    completarOnboarding(ctx);
    return {
      id: e.id,
      hoy: e.hoy,
      cuentas,
      contactos,
      ingresoId,
      esperado: e.esperado,
      catalogoSuscripciones: e.catalogo_suscripciones,
    };
  });
}
