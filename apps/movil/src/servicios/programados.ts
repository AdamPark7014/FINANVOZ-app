import { and, asc, eq } from 'drizzle-orm';
import { ErrorDominio, type Centavos, type PlainDate, type Regla } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { Regla as ReglaZod } from '@cartera/nlu';
import type { Contexto } from './contexto';

const { programado } = esquema;

export interface ProgramadoLeido {
  readonly id: string;
  readonly tipo: 'ingreso' | 'egreso';
  readonly concepto: string;
  readonly monto: Centavos;
  readonly regla: Regla;
  readonly cuentaId: string | null;
  readonly categoriaCuentaId: string | null;
  readonly tarjetaId: string | null;
  readonly variable: boolean;
  readonly defineHorizonte: boolean;
  readonly desde: PlainDate;
  readonly hasta: PlainDate | null;
  readonly activo: boolean;
}

/** Valida una regla de E3.1 (JSON de `programado.regla`). */
export function validarRegla(valor: unknown): Regla {
  const r = ReglaZod.safeParse(valor);
  if (!r.success) throw new ErrorDominio('regla_invalida', 'la regla de recurrencia no es válida');
  return r.data as Regla;
}

function leer(f: typeof programado.$inferSelect): ProgramadoLeido {
  return {
    id: f.id,
    tipo: f.tipo,
    concepto: f.concepto,
    monto: f.monto,
    regla: validarRegla(JSON.parse(f.regla)),
    cuentaId: f.cuentaId,
    categoriaCuentaId: f.categoriaCuentaId,
    tarjetaId: f.tarjetaId,
    variable: f.variable === 1,
    defineHorizonte: f.defineHorizonte === 1,
    desde: f.desde,
    hasta: f.hasta,
    activo: f.activo === 1,
  };
}

/** Programados activos del espacio personal, en orden de alta. */
export function programadosActivos(ctx: Contexto): ProgramadoLeido[] {
  return ctx.db
    .select()
    .from(programado)
    .where(and(eq(programado.activo, 1), eq(programado.espacio, 'personal')))
    .orderBy(asc(programado.desde), asc(programado.id))
    .all()
    .map(leer);
}

export function programadoPorId(ctx: Contexto, id: string): ProgramadoLeido {
  const f = ctx.db.select().from(programado).where(eq(programado.id, id)).get();
  if (!f) throw new ErrorDominio('programado_inexistente', 'el pago programado no existe');
  return leer(f);
}

/** El ingreso que define el horizonte (E3.3), si hay uno activo. */
export function ingresoPrincipal(ctx: Contexto): ProgramadoLeido | null {
  const f = ctx.db
    .select()
    .from(programado)
    .where(and(eq(programado.defineHorizonte, 1), eq(programado.activo, 1)))
    .get();
  return f ? leer(f) : null;
}

export function insertarProgramado(
  ctx: Contexto,
  datos: {
    tipo: 'ingreso' | 'egreso';
    concepto: string;
    monto: Centavos;
    regla: Regla;
    desde: PlainDate;
    hasta?: PlainDate | null;
    cuentaId?: string | null;
    categoriaCuentaId?: string | null;
    /** Comercio normalizado (E9.1) para cubrir por comercio (E3.5); lo pone "Convertir en compromiso" (E14). */
    comercioNormalizado?: string | null;
    variable?: boolean;
    defineHorizonte?: boolean;
  },
): string {
  const regla = validarRegla(datos.regla);
  if (!Number.isSafeInteger(datos.monto) || datos.monto <= 0) {
    throw new ErrorDominio('monto_invalido', 'el monto debe ser mayor que cero');
  }
  const id = ctx.generarId();
  ctx.db
    .insert(programado)
    .values({
      id,
      tipo: datos.tipo,
      concepto: datos.concepto,
      monto: datos.monto,
      regla: JSON.stringify(regla),
      cuentaId: datos.cuentaId ?? null,
      categoriaCuentaId: datos.categoriaCuentaId ?? null,
      comercioNormalizado: datos.comercioNormalizado ?? null,
      variable: datos.variable ? 1 : 0,
      defineHorizonte: datos.defineHorizonte ? 1 : 0,
      desde: datos.desde,
      hasta: datos.hasta ?? null,
    })
    .run();
  return id;
}
