import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { ErrorDominio, type Centavos, type PlainDate } from '@cartera/core';
import {
  construirReversa,
  esOrigen,
  validarAsientos,
  validarTransaccion,
  type AsientoPropuesto,
  type CuentaParaPatron,
  type Origen,
  type TipoTransaccion,
} from '@cartera/core';
import { asiento, cuenta, transaccion } from './esquema';

/**
 * Instancia de Drizzle ya abierta y síncrona (`better-sqlite3` en pruebas, `expo-sqlite` en la app). El
 * repositorio no abre ni configura la base (`docs/03-ARQUITECTURA.md §4`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el repositorio no depende del esquema relacional del llamador
export type BaseDatos = BaseSQLiteDatabase<'sync', unknown, any, any>;

export interface OpcionesLibro {
  /** Genera ids (UUIDv7 en la app). Los ids se generan en la capa de servicios, nunca en `core`. */
  readonly generarId: () => string;
  /** Instante actual en ms UTC para `registrada_en`. */
  readonly ahora: () => number;
}

export interface TransaccionNueva {
  readonly tipo: TipoTransaccion;
  readonly fecha: PlainDate;
  readonly origen: Origen;
  readonly claveIdempotencia: string;
  readonly asientos: readonly AsientoPropuesto[];
  readonly descripcion?: string | null;
  readonly comercio?: string | null;
  readonly estimada?: boolean;
  readonly extraordinaria?: boolean;
  readonly porRevisar?: boolean;
  /** JSON ya validado por el llamador. */
  readonly meta?: string | null;
}

export interface AsientoRegistrado {
  readonly id: string;
  readonly cuentaId: string;
  readonly monto: Centavos;
}

export interface TransaccionRegistrada {
  readonly id: string;
  readonly tipo: TipoTransaccion;
  readonly fecha: PlainDate;
  readonly origen: Origen;
  readonly claveIdempotencia: string;
  readonly registradaEn: number;
  readonly estimada: boolean;
  readonly revierteA: string | null;
  readonly reemplazaA: string | null;
  readonly asientos: readonly AsientoRegistrado[];
}

export interface ResultadoRegistro {
  readonly transaccion: TransaccionRegistrada;
  /** `false` si la clave de idempotencia ya existía y se devolvió la transacción existente (E2 regla 1). */
  readonly nueva: boolean;
}

export interface ResultadoReemplazo {
  readonly reversa: TransaccionRegistrada;
  readonly nueva: TransaccionRegistrada;
}

export interface OpcionesAnulacion {
  /** Origen de la reversa; por defecto el de la transacción anulada. */
  readonly origen?: Origen;
}

export type ProblemaIntegridad =
  | { readonly tipo: 'suma_distinta_de_cero'; readonly transaccionId: string }
  | { readonly tipo: 'menos_de_dos_asientos'; readonly transaccionId: string }
  | { readonly tipo: 'monto_no_entero'; readonly transaccionId: string }
  | { readonly tipo: 'libro_descuadrado'; readonly suma: Centavos };

/** Clave de la reversa de `id`: determinista, así una anulación repetida choca con `UNIQUE`. */
export const claveReversa = (id: string): string => `reversa:${id}`;

const p = (nombre: string) => sql.placeholder(nombre);

/**
 * Consultas preparadas una sola vez por `Libro` (construir SQL con Drizzle cuesta más que ejecutarlo). Corren
 * en la misma conexión, así que también valen dentro de `db.transaction`.
 */
function prepararConsultas(db: BaseDatos) {
  return {
    porClave: db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.claveIdempotencia, p('clave')))
      .prepare(),
    reversaDe: db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.revierteA, p('id')))
      .prepare(),
    transaccion: db
      .select()
      .from(transaccion)
      .where(eq(transaccion.id, p('id')))
      .prepare(),
    asientos: db
      .select({ id: asiento.id, cuentaId: asiento.cuentaId, monto: asiento.monto })
      .from(asiento)
      .where(eq(asiento.transaccionId, p('id')))
      .orderBy(asc(sql`rowid`))
      .prepare(),
    cuenta: db
      .select()
      .from(cuenta)
      .where(eq(cuenta.id, p('id')))
      .prepare(),
    // Saldo a hoy (sin fecha de corte): todo asiento cuenta, así que no hace falta unir con `transaccion`; con
    // el índice `asiento_cuenta` es ~5 veces más rápido en un libro grande (RNF-01, pase de M13).
    saldoTotal: db
      .select({ suma: sql<number>`coalesce(sum(${asiento.monto}), 0)` })
      .from(asiento)
      .where(eq(asiento.cuentaId, p('cuenta')))
      .prepare(),
    saldo: db
      .select({ suma: sql<number>`coalesce(sum(${asiento.monto}), 0)` })
      .from(asiento)
      .innerJoin(transaccion, eq(transaccion.id, asiento.transaccionId))
      .where(and(eq(asiento.cuentaId, p('cuenta')), lte(transaccion.fecha, p('hasta'))))
      .prepare(),
    insertarTransaccion: db
      .insert(transaccion)
      .values({
        id: p('id'),
        fecha: p('fecha'),
        registradaEn: p('registradaEn'),
        tipo: p('tipo'),
        descripcion: p('descripcion'),
        comercio: p('comercio'),
        origen: p('origen'),
        estimada: p('estimada'),
        extraordinaria: p('extraordinaria'),
        porRevisar: p('porRevisar'),
        claveIdempotencia: p('clave'),
        revierteA: p('revierteA'),
        reemplazaA: p('reemplazaA'),
        meta: p('meta'),
      })
      .prepare(),
    insertarAsiento: db
      .insert(asiento)
      .values({ id: p('id'), transaccionId: p('transaccionId'), cuentaId: p('cuentaId'), monto: p('monto') })
      .prepare(),
  };
}

/**
 * Repositorio del libro (E2, `docs/05-MOTORES.md §E2`). Toda escritura financiera pasa por aquí y cada
 * operación corre en una transacción SQLite (o en un savepoint si el llamador ya abrió una).
 */
export class Libro {
  private consultasPreparadas: ReturnType<typeof prepararConsultas> | undefined;

  constructor(
    private readonly db: BaseDatos,
    private readonly opciones: OpcionesLibro,
  ) {}

  private get q(): ReturnType<typeof prepararConsultas> {
    this.consultasPreparadas ??= prepararConsultas(this.db);
    return this.consultasPreparadas;
  }

  /** E2 regla 1. Si la clave de idempotencia ya existe devuelve la transacción existente (no es error). */
  registrar(nueva: TransaccionNueva): ResultadoRegistro {
    return this.db.transaction(() => this.registrarEn(nueva, null));
  }

  /** E2 regla 2: transacción espejo con la misma fecha y `revierte_a = id`. */
  anular(id: string, opciones: OpcionesAnulacion = {}): TransaccionRegistrada {
    return this.db.transaction(() => this.anularEn(id, opciones));
  }

  /**
   * E2 regla 2: anular `id` y registrar `nueva` con `reemplaza_a = id`, en una sola transacción SQLite. Si
   * `nueva.claveIdempotencia` ya reemplazó a `id`, devuelve el par existente.
   */
  reemplazar(id: string, nueva: TransaccionNueva, opciones: OpcionesAnulacion = {}): ResultadoReemplazo {
    return this.db.transaction(() => {
      const previa = this.buscarPorClave(nueva.claveIdempotencia);
      if (previa) {
        const reversa = this.buscarPorClave(claveReversa(id));
        if (previa.reemplazaA !== id || !reversa) {
          throw new ErrorDominio('clave_duplicada', 'la clave de idempotencia ya se usó en otra transacción');
        }
        return { reversa, nueva: previa };
      }
      const reversa = this.anularEn(id, opciones);
      const registrada = this.registrarEn(nueva, id).transaccion;
      return { reversa, nueva: registrada };
    });
  }

  /** E2 regla 3: Σ de todos los asientos de la cuenta con `fecha ≤ hasta` (sin filtrar reversas). */
  saldo(cuentaId: string, hasta?: PlainDate): Centavos {
    const fila =
      hasta === undefined
        ? this.q.saldoTotal.get({ cuenta: cuentaId })
        : this.q.saldo.get({ cuenta: cuentaId, hasta });
    return Number(fila?.suma ?? 0);
  }

  obtener(id: string): TransaccionRegistrada | null {
    const t = this.q.transaccion.get({ id });
    if (!t) return null;
    return {
      id: t.id,
      tipo: t.tipo as TipoTransaccion,
      fecha: t.fecha,
      origen: t.origen as Origen,
      claveIdempotencia: t.claveIdempotencia,
      registradaEn: t.registradaEn,
      estimada: t.estimada === 1,
      revierteA: t.revierteA,
      reemplazaA: t.reemplazaA,
      asientos: this.q.asientos.all({ id }),
    };
  }

  /** Comprobación de integridad de `docs/04-DATOS.md §3`: vacía cuando el libro está sano. */
  comprobarIntegridad(): ProblemaIntegridad[] {
    return comprobarIntegridad(this.db);
  }

  private buscarPorClave(clave: string): TransaccionRegistrada | null {
    const fila = this.q.porClave.get({ clave });
    return fila ? this.obtener(fila.id) : null;
  }

  private exigir(id: string): TransaccionRegistrada {
    const t = this.obtener(id);
    if (!t) throw new ErrorDominio('transaccion_inexistente', `no existe la transacción ${id}`);
    return t;
  }

  private cargarCuentas(asientos: readonly AsientoPropuesto[]): ReadonlyMap<string, CuentaParaPatron> {
    const cuentas = new Map<string, CuentaParaPatron>();
    for (const a of asientos) {
      if (cuentas.has(a.cuentaId)) continue;
      const f = this.q.cuenta.get({ id: a.cuentaId });
      if (!f) continue;
      cuentas.set(f.id, {
        id: f.id,
        naturaleza: f.naturaleza,
        subtipo: f.subtipo,
        liquida: f.liquida === 1,
        espacio: f.espacio,
        archivada: f.archivada === 1,
        padreId: f.padreId,
        categoriaSlug: f.categoriaSlug,
      });
    }
    return cuentas;
  }

  private registrarEn(nueva: TransaccionNueva, reemplazaA: string | null): ResultadoRegistro {
    if (typeof nueva.claveIdempotencia !== 'string' || nueva.claveIdempotencia === '') {
      throw new ErrorDominio('clave_invalida', 'falta la clave de idempotencia');
    }
    const existente = this.buscarPorClave(nueva.claveIdempotencia);
    if (existente) return { transaccion: existente, nueva: false };

    if (!esOrigen(nueva.origen))
      throw new ErrorDominio('origen_invalido', `origen inválido: ${nueva.origen}`);
    const estimada = nueva.estimada ?? false;
    validarTransaccion(
      { tipo: nueva.tipo, fecha: nueva.fecha, asientos: nueva.asientos, estimada },
      this.cargarCuentas(nueva.asientos),
    );
    if (reemplazaA !== null && !this.q.transaccion.get({ id: reemplazaA })) {
      throw new ErrorDominio('transaccion_inexistente', `no existe la transacción ${reemplazaA}`);
    }

    const id = this.opciones.generarId();
    this.q.insertarTransaccion.run({
      id,
      fecha: nueva.fecha,
      registradaEn: this.opciones.ahora(),
      tipo: nueva.tipo,
      descripcion: nueva.descripcion ?? null,
      comercio: nueva.comercio ?? null,
      origen: nueva.origen,
      estimada: estimada ? 1 : 0,
      extraordinaria: nueva.extraordinaria ? 1 : 0,
      porRevisar: nueva.porRevisar ? 1 : 0,
      clave: nueva.claveIdempotencia,
      revierteA: null,
      reemplazaA,
      meta: nueva.meta ?? null,
    });
    this.insertarAsientos(id, nueva.asientos);
    return { transaccion: this.exigir(id), nueva: true };
  }

  private anularEn(id: string, opciones: OpcionesAnulacion): TransaccionRegistrada {
    const original = this.obtener(id);
    if (!original) throw new ErrorDominio('transaccion_inexistente', `no existe la transacción ${id}`);
    if (original.tipo === 'reversa') {
      throw new ErrorDominio(
        'reversa_no_anulable',
        'una reversa no se anula; registra de nuevo el movimiento',
      );
    }
    if (this.q.reversaDe.get({ id })) {
      throw new ErrorDominio('ya_anulada', `la transacción ${id} ya está anulada`);
    }

    const espejo = construirReversa(original.asientos);
    validarAsientos(espejo.asientos);
    const reversaId = this.opciones.generarId();
    this.q.insertarTransaccion.run({
      id: reversaId,
      fecha: original.fecha,
      registradaEn: this.opciones.ahora(),
      tipo: 'reversa',
      descripcion: null,
      comercio: null,
      origen: opciones.origen ?? original.origen,
      estimada: 0,
      extraordinaria: 0,
      porRevisar: 0,
      clave: claveReversa(id),
      revierteA: id,
      reemplazaA: null,
      meta: null,
    });
    this.insertarAsientos(reversaId, espejo.asientos);
    return this.exigir(reversaId);
  }

  private insertarAsientos(transaccionId: string, asientos: readonly AsientoPropuesto[]): void {
    for (const a of asientos) {
      this.q.insertarAsiento.run({
        id: this.opciones.generarId(),
        transaccionId,
        cuentaId: a.cuentaId,
        monto: a.monto,
      });
    }
  }
}

/** Comprobación de integridad de `docs/04-DATOS.md §3`: vacía cuando el libro está sano. */
export function comprobarIntegridad(db: BaseDatos): ProblemaIntegridad[] {
  const problemas: ProblemaIntegridad[] = [];
  const descuadradas = db.all<{ transaccion_id: string }>(
    sql`SELECT transaccion_id FROM asiento GROUP BY transaccion_id HAVING SUM(monto) <> 0`,
  );
  for (const f of descuadradas)
    problemas.push({ tipo: 'suma_distinta_de_cero', transaccionId: f.transaccion_id });
  const cortas = db.all<{ id: string }>(
    sql`SELECT t.id FROM transaccion t LEFT JOIN asiento a ON a.transaccion_id = t.id
        GROUP BY t.id HAVING COUNT(a.id) < 2`,
  );
  for (const f of cortas) problemas.push({ tipo: 'menos_de_dos_asientos', transaccionId: f.id });
  // Un respaldo manipulado puede traer 0.5 / -0.5: suma cero, pero no son centavos.
  const noEnteros = db.all<{ transaccion_id: string }>(
    sql`SELECT DISTINCT transaccion_id FROM asiento WHERE typeof(monto) <> 'integer'`,
  );
  for (const f of noEnteros) problemas.push({ tipo: 'monto_no_entero', transaccionId: f.transaccion_id });
  const total = db.get<{ suma: number | null }>(sql`SELECT SUM(monto) AS suma FROM asiento`);
  const suma = Number(total?.suma ?? 0);
  if (suma !== 0) problemas.push({ tipo: 'libro_descuadrado', suma });
  return problemas;
}
