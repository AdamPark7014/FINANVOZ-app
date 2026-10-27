import { and, desc, eq, gte, inArray, lte, ne, type SQL } from 'drizzle-orm';
import type { Centavos, Origen, PlainDate, TipoTransaccion } from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import type { Contexto } from './contexto';
import { etiquetaDiaMes } from './formato';

const { transaccionVigente: tv, asiento, cuenta } = esquema;

export type Insignia = 'automatico' | 'estimado' | 'por_asignar' | 'corregido';

/** Movimiento en lenguaje llano (`02 §10`): sin débito/crédito ni asientos. */
export interface MovimientoVista {
  readonly id: string;
  readonly fecha: PlainDate;
  readonly tipo: TipoTransaccion;
  readonly descripcion: string | null;
  readonly comercio: string | null;
  readonly origen: Origen;
  readonly registradaEn: number;
  /** Lo que se movió (positivo). */
  readonly monto: Centavos;
  readonly sentido: 'salida' | 'entrada' | 'neutro';
  /** "Salió de": cuentas propias, tarjetas o personas acreditadas. */
  readonly saleDe: readonly string[];
  /** "Llegó a": cuentas propias, tarjetas o personas cargadas. */
  readonly llegaA: readonly string[];
  /** Personas del movimiento (cuenta `contraparte:persona`), sin repetir id. */
  readonly personas: readonly { readonly id: string; readonly nombre: string }[];
  readonly categoria: string | null;
  /** Slug del catálogo (`04 §2.3`) para el ícono de la categoría; `null` sin categoría. */
  readonly categoriaSlug: string | null;
  readonly porRevisar: boolean;
  /** Marcado como "Fue algo extraordinario": no cuenta para estimar el gasto diario (`05 §E8.2`). */
  readonly extraordinaria: boolean;
  readonly insignias: readonly Insignia[];
  /** Movimiento al que reemplazó (corrección, `04 §4`); su historial sale de `historialMovimiento`. */
  readonly reemplazaA: string | null;
}

export interface DiaMovimientos {
  readonly fecha: PlainDate;
  /** "11 oct" */
  readonly etiqueta: string;
  readonly movimientos: readonly MovimientoVista[];
  /** Suma de montos con sentido salida ese día (`02 §10` / PLAN-UX 3.7). */
  readonly salieron: Centavos;
  /** Suma de montos con sentido entrada ese día. */
  readonly entraron: Centavos;
}

export interface FiltroMovimientos {
  readonly desde?: PlainDate;
  readonly hasta?: PlainDate;
  readonly cuentaId?: string;
  readonly categoria?: string;
  /** Alguna de estas categorías (grupos de consultas, `04 §2.3`). */
  readonly categorias?: readonly string[];
  /** Solo movimientos con gasto (consultas de gasto, `06 §6`). */
  readonly soloGastos?: boolean;
  readonly origen?: Origen;
  /** Chips de Movimientos: solo lo que sale (gastos) o lo que entra (ingresos). */
  readonly sentido?: 'salida' | 'entrada';
  /** Chips de Movimientos: con efectivo o con una tarjeta de crédito (incluye compras a meses). */
  readonly medio?: 'efectivo' | 'tarjeta';
  readonly porRevisar?: boolean;
  readonly estimados?: boolean;
  /**
   * «Buscar» del dock de Movimientos: texto contenido (sin acentos ni mayúsculas) en la descripción, el comercio, la
   * categoría, las cuentas o las personas; si son solo dígitos, también en el monto en pesos.
   */
  readonly texto?: string;
  readonly limite?: number;
}

/** Texto comparable para la búsqueda: minúsculas, sin acentos ni espacios repetidos. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function coincideBusqueda(m: MovimientoVista, buscado: string): boolean {
  const campos = [
    m.descripcion,
    m.comercio,
    m.categoria,
    ...m.saleDe,
    ...m.llegaA,
    ...m.personas.map((p) => p.nombre),
  ];
  if (campos.some((c) => c !== null && normalizarBusqueda(c).includes(buscado))) return true;
  return /^\d+$/.test(buscado) && String(Math.floor(m.monto / 100)).includes(buscado);
}

const SALIDA = new Set<string>([
  'gasto',
  'prestamo_otorgado',
  'pago_prestamo',
  'aportacion_tanda',
  'cuenta_dividida',
  'ajuste_arqueo',
]);
const ENTRADA = new Set<string>([
  'ingreso',
  'prestamo_recibido',
  'cobro_prestamo',
  'cobro_tanda',
  'reembolso',
]);
const AUTOMATICOS = new Set<string>(['notificacion', 'correo', 'estado_cuenta', 'ticket']);
const PUENTES = new Set<string>([CUENTAS_SISTEMA.porAsignar, CUENTAS_SISTEMA.porAsignarEntradas]);

/** ¿Hay al menos un movimiento vigente (sin contar saldos de apertura)? Hoy lo usa para la tarjeta de primer uso. */
export function hayMovimientos(ctx: Contexto): boolean {
  return (
    ctx.db.select({ id: tv.id }).from(tv).where(ne(tv.tipo, 'saldo_inicial')).limit(1).get() !== undefined
  );
}

/**
 * Movimientos vigentes (sin anulados ni reversas, ni saldos de apertura) agrupados por día, del más reciente al
 * más antiguo, con los filtros de `02 §10`.
 */
export function listarMovimientos(ctx: Contexto, filtro: FiltroMovimientos = {}): DiaMovimientos[] {
  const condiciones: SQL[] = [ne(tv.tipo, 'saldo_inicial')];
  if (filtro.desde) condiciones.push(gte(tv.fecha, filtro.desde));
  if (filtro.hasta) condiciones.push(lte(tv.fecha, filtro.hasta));
  if (filtro.origen) condiciones.push(eq(tv.origen, filtro.origen));
  if (filtro.porRevisar !== undefined) condiciones.push(eq(tv.porRevisar, filtro.porRevisar ? 1 : 0));
  if (filtro.estimados !== undefined) condiciones.push(eq(tv.estimada, filtro.estimados ? 1 : 0));
  const transacciones = ctx.db
    .select()
    .from(tv)
    .where(and(...condiciones))
    .orderBy(desc(tv.fecha), desc(tv.registradaEn))
    .all();
  if (transacciones.length === 0) return [];

  const asientos = ctx.db
    .select({ transaccionId: asiento.transaccionId, monto: asiento.monto, c: cuenta })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(
      inArray(
        asiento.transaccionId,
        transacciones.map((t) => t.id),
      ),
    )
    .all();
  const porTransaccion = new Map<string, typeof asientos>();
  for (const a of asientos)
    porTransaccion.set(a.transaccionId, [...(porTransaccion.get(a.transaccionId) ?? []), a]);

  const vistas: MovimientoVista[] = [];
  const buscado = filtro.texto ? normalizarBusqueda(filtro.texto) : '';
  for (const t of transacciones) {
    const suyos = porTransaccion.get(t.id) ?? [];
    if (filtro.cuentaId && !suyos.some((a) => a.c.id === filtro.cuentaId)) continue;
    const categoria = suyos.find((a) => a.c.naturaleza === 'gasto' || a.c.naturaleza === 'ingreso')?.c;
    if (filtro.categoria && categoria?.categoriaSlug !== filtro.categoria) continue;
    const gastos = suyos.filter((a) => a.c.naturaleza === 'gasto');
    if (filtro.soloGastos && gastos.length === 0) continue;
    const categorias = filtro.categorias;
    if (
      categorias &&
      !gastos.some((a) => a.c.categoriaSlug !== null && categorias.includes(a.c.categoriaSlug))
    )
      continue;
    const propias = suyos.filter((a) => a.c.naturaleza !== 'gasto' && a.c.naturaleza !== 'ingreso');
    const sentido = SALIDA.has(t.tipo) ? 'salida' : ENTRADA.has(t.tipo) ? 'entrada' : 'neutro';
    if (filtro.sentido && sentido !== filtro.sentido) continue;
    if (
      filtro.medio &&
      !suyos.some((a) =>
        filtro.medio === 'efectivo'
          ? a.c.naturaleza === 'activo' && a.c.subtipo === 'efectivo'
          : a.c.naturaleza === 'pasivo' && (a.c.subtipo === 'tarjeta_credito' || a.c.subtipo === 'msi'),
      )
    )
      continue;
    const personasPorId = new Map<string, string>();
    for (const a of suyos) {
      if (a.c.naturaleza === 'contraparte' && a.c.subtipo === 'persona' && a.monto !== 0) {
        personasPorId.set(a.c.id, a.c.nombre);
      }
    }
    const personas = [...personasPorId.entries()].map(([id, nombre]) => ({ id, nombre }));
    const insignias: Insignia[] = [];
    if (AUTOMATICOS.has(t.origen)) insignias.push('automatico');
    if (t.estimada === 1) insignias.push('estimado');
    if (suyos.some((a) => PUENTES.has(a.c.id))) insignias.push('por_asignar');
    if (t.reemplazaA) insignias.push('corregido');
    const vista: MovimientoVista = {
      id: t.id,
      fecha: t.fecha,
      tipo: t.tipo as TipoTransaccion,
      descripcion: t.descripcion,
      comercio: t.comercio,
      origen: t.origen as Origen,
      registradaEn: t.registradaEn,
      monto: suyos.reduce((s, a) => s + Math.max(0, a.monto), 0),
      sentido,
      saleDe: propias.filter((a) => a.monto < 0).map((a) => a.c.nombre),
      llegaA: propias.filter((a) => a.monto > 0).map((a) => a.c.nombre),
      personas,
      categoria: categoria?.nombre ?? null,
      categoriaSlug: categoria?.categoriaSlug ?? null,
      porRevisar: t.porRevisar === 1,
      extraordinaria: t.extraordinaria === 1,
      insignias,
      reemplazaA: t.reemplazaA,
    };
    if (buscado && !coincideBusqueda(vista, buscado)) continue;
    vistas.push(vista);
    if (filtro.limite !== undefined && vistas.length >= filtro.limite) break;
  }

  type DiaEnArmado = { -readonly [K in keyof DiaMovimientos]: DiaMovimientos[K] } & {
    movimientos: MovimientoVista[];
  };
  const dias: DiaEnArmado[] = [];
  for (const m of vistas) {
    const ultimo = dias[dias.length - 1];
    let dia: DiaEnArmado;
    if (ultimo && ultimo.fecha === m.fecha) {
      dia = ultimo;
      dia.movimientos.push(m);
    } else {
      dia = {
        fecha: m.fecha,
        etiqueta: etiquetaDiaMes(m.fecha),
        movimientos: [m],
        salieron: 0 as Centavos,
        entraron: 0 as Centavos,
      };
      dias.push(dia);
    }
    if (m.sentido === 'salida') dia.salieron = (dia.salieron + m.monto) as Centavos;
    else if (m.sentido === 'entrada') dia.entraron = (dia.entraron + m.monto) as Centavos;
  }
  return dias;
}
