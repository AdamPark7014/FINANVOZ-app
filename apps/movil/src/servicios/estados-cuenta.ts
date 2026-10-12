/**
 * Estados de cuenta en PDF (M15, `07 §8`, `02 §26`): leer el texto que el teléfono extrajo del PDF, completar
 * la tarjeta con los movimientos que no tenía (E9.3, sin duplicar) y conciliar su saldo al corte.
 *
 * Nada de aquí sale del teléfono ni escribe en logs (regla 9): el texto del PDF solo vive en memoria mientras la
 * pantalla lo revisa; al guardar quedan los movimientos nuevos (con su descripción, como cualquier movimiento) y
 * una fila `captura` de fuente `estado_cuenta` por renglón revisado, sin texto (solo tarjeta, corte y renglón).
 */
import { and, asc, eq, gte, inArray, isNotNull, like, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  completarConEstado,
  construirConciliacion,
  construirGasto,
  construirPagoRecibidoPendiente,
  CUENTA_POR_ASIGNAR,
  CUENTA_POR_ASIGNAR_ENTRADAS,
  deudaComparableAlCorte,
  deudaDeMovimiento,
  DIAS_EN_CAMINO,
  ErrorDominio,
  leerEstadoCuentaPdf,
  sumarDias,
  type CatalogoAnalizadores,
  type Centavos,
  type DecisionRenglon,
  type EstadoCuentaLeido,
  type MovimientoEstado,
  type MovimientoExistente,
  type MovimientoPropuesto,
  type PlainDate,
  type TipoMovimientoEstado,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, idCategoria, type TransaccionNueva } from '@cartera/datos';
import { bancosConAnalizador, catalogoAnalizadoresApp } from '../captura/analizadores';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { internos, vigenteDe, type DatosCaptura } from './capturas';
import { liberarOcurrencias } from './cobertura';
import { enTransaccion, type Contexto } from './contexto';
import { procesarCortes, recalcularCortesDesde } from './cortes';
import { trasRegistrar } from './formulario';
import { tarjetasActivas, type TarjetaLeida } from './tarjetas';

const { captura, transaccionVigente: tv, asiento, cuenta } = esquema;

/** Una tarjeta para elegir o mostrar. */
export interface TarjetaEstado {
  readonly cuentaId: string;
  readonly nombre: string;
  readonly ultimos4: string | null;
}

export interface RenglonEstado {
  readonly indice: number;
  readonly fecha: PlainDate;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly tipo: TipoMovimientoEstado;
  /** Slug de la categoría con que se guardaría (solo cargos y comisiones). */
  readonly categoria: string | null;
}

export interface RenglonDudoso extends RenglonEstado {
  /** El movimiento que quizá es el mismo. */
  readonly transaccionId: string;
  readonly existente: {
    readonly fecha: PlainDate;
    readonly descripcion: string | null;
    readonly monto: Centavos;
  };
}

export interface AnalisisEstadoCuenta {
  readonly tarjeta: TarjetaEstado;
  readonly banco: string;
  readonly corte: PlainDate;
  readonly limite: PlainDate | null;
  /** Movimientos que trae el estado de cuenta. */
  readonly total: number;
  /** Los que ya tenías (incluidos los que ya revisaste al leer antes este mismo estado). */
  readonly yaLosTenias: number;
  /** "No los tenía": se proponen para agregar. */
  readonly nuevos: readonly RenglonEstado[];
  /** "Quizá ya los tenías": la persona decide (E9.3 preguntar). */
  readonly dudosos: readonly RenglonDudoso[];
  /** De antes de que agregaras la tarjeta: ya están en el saldo con que la diste de alta. */
  readonly anteriores: number;
  /** Renglones que no se pudieron leer (no se agregan). */
  readonly renglonesSinLeer: number;
  /** Con totales impresos: ¿lo leído suma lo mismo? */
  readonly cuadra: boolean | null;
  /** Lo que debes al corte según el banco (negativo = saldo a favor). */
  readonly saldoBanco: Centavos;
  /** Lo que diría Cartera al corte si guardas los nuevos (y los dudosos son los mismos). */
  readonly saldoCartera: Centavos;
  readonly coincide: boolean;
}

export type LecturaEstadoCuenta =
  | { readonly tipo: 'escaneado' }
  | { readonly tipo: 'no_reconocido'; readonly bancos: readonly string[] }
  | { readonly tipo: 'incompleto'; readonly banco: string }
  | { readonly tipo: 'sin_tarjetas'; readonly banco: string }
  | {
      readonly tipo: 'elegir_tarjeta';
      readonly banco: string;
      readonly ultimos4: string | null;
      readonly corte: PlainDate;
      readonly tarjetas: readonly TarjetaEstado[];
    }
  | { readonly tipo: 'anterior_al_alta'; readonly tarjeta: TarjetaEstado; readonly corte: PlainDate }
  | { readonly tipo: 'listo'; readonly analisis: AnalisisEstadoCuenta };

export interface OpcionesEstado {
  /** La tarjeta elegida por la persona; si no, se busca por terminación y banco. */
  readonly tarjetaId?: string | undefined;
  /** Por omisión, el de la app (`captura/analizadores.ts`). */
  readonly catalogo?: CatalogoAnalizadores | undefined;
}

// ——— Lectura y análisis ———

function aTarjetaEstado(t: TarjetaLeida): TarjetaEstado {
  return { cuentaId: t.cuentaId, nombre: t.nombre, ultimos4: t.ultimos4 };
}

/** `07 §5` paso 1 aplicado al estado: por terminación (de su banco o sin banco); si no, la única de ese banco. */
function tarjetasPosibles(tarjetas: readonly TarjetaLeida[], e: EstadoCuentaLeido): TarjetaLeida[] {
  const deMiBanco = (t: TarjetaLeida) => t.institucion === null || t.institucion === e.banco;
  if (e.ultimos4 !== null) {
    const porTerminacion = tarjetas.filter((t) => t.ultimos4 === e.ultimos4 && deMiBanco(t));
    const exactas = porTerminacion.filter((t) => t.institucion === e.banco);
    return exactas.length === 1 ? exactas : porTerminacion;
  }
  return tarjetas.filter((t) => t.institucion === e.banco);
}

const HUELLA = (tarjeta: string, corte: PlainDate, indice: number | '') => `ec:${tarjeta}:${corte}:${indice}`;

/** `captura.datos` de un renglón de estado de cuenta: sin texto ni montos, solo dónde está. */
const DatosRenglon = z.strictObject({
  tarjeta: z.string(),
  corte: z.string(),
  indice: z.int().min(0),
  analizador: z.string(),
  decision: z.enum(['existente', 'agregado', 'omitido']),
});

/** Renglones de este estado (tarjeta y corte) ya revisados, con su movimiento vigente. */
function renglonesRevisados(ctx: Contexto, tarjeta: string, corte: PlainDate): Map<number, string | null> {
  const filas = ctx.db
    .select({ datos: captura.datos, tx: captura.transaccionId })
    .from(captura)
    .where(and(eq(captura.fuente, 'estado_cuenta'), like(captura.huella, `${HUELLA(tarjeta, corte, '')}%`)))
    .all();
  const salida = new Map<number, string | null>();
  for (const f of filas) {
    const d = DatosRenglon.safeParse(JSON.parse(f.datos ?? 'null'));
    if (d.success) salida.set(d.data.indice, vigenteDe(ctx, f.tx));
  }
  return salida;
}

/** Movimientos vigentes ya absorbidos por un renglón de algún estado de cuenta (uno a uno por fuente, E9.3). */
function absorbidosPorEstados(ctx: Contexto): Set<string> {
  const ids = new Set<string>();
  const filas = ctx.db
    .select({ tx: captura.transaccionId })
    .from(captura)
    .where(and(eq(captura.fuente, 'estado_cuenta'), isNotNull(captura.transaccionId)))
    .all();
  for (const f of filas) {
    const v = vigenteDe(ctx, f.tx);
    if (v) ids.add(v);
  }
  return ids;
}

/** Saldos iniciales, conciliaciones, reversas y cuotas MSI no son movimientos que un estado de cuenta liste. */
const TIPOS_FUERA = new Set([
  'saldo_inicial',
  'conciliacion',
  'reversa',
  'reclasificacion_msi',
  'liquidacion_msi',
  'ajuste_arqueo',
]);

interface Candidato extends MovimientoExistente {
  readonly descripcion: string | null;
  /** Efecto en la deuda de la tarjeta misma (no de su subcuenta MSI ni de la puente). */
  readonly deudaTarjeta: Centavos;
}

/**
 * Movimientos vigentes de la tarjeta (o de sus subcuentas MSI, o de las cuentas puente) entre `desde` y `hasta`,
 * en orden de registro, sin los absorbidos por otro estado de cuenta.
 */
function candidatos(ctx: Contexto, tarjeta: string, desde: PlainDate, hasta: PlainDate): Candidato[] {
  const subcuentas = ctx.db
    .select({ id: cuenta.id })
    .from(cuenta)
    .where(eq(cuenta.padreId, tarjeta))
    .all()
    .map((f) => f.id);
  const puentes = [CUENTAS_SISTEMA.porAsignar, CUENTAS_SISTEMA.porAsignarEntradas];
  const filas = ctx.db
    .select({
      id: tv.id,
      fecha: tv.fecha,
      tipo: tv.tipo,
      comercio: tv.comercio,
      descripcion: tv.descripcion,
      cuentaId: asiento.cuentaId,
      monto: asiento.monto,
    })
    .from(tv)
    .innerJoin(asiento, eq(asiento.transaccionId, tv.id))
    .where(
      and(
        gte(tv.fecha, desde),
        lte(tv.fecha, hasta),
        inArray(asiento.cuentaId, [tarjeta, ...subcuentas, ...puentes]),
      ),
    )
    .orderBy(asc(tv.registradaEn), asc(tv.id), asc(asiento.id))
    .all();
  const absorbidos = absorbidosPorEstados(ctx);
  const vistos = new Set<string>();
  const salida: Candidato[] = [];
  for (const f of filas) {
    if (vistos.has(f.id) || TIPOS_FUERA.has(f.tipo) || absorbidos.has(f.id)) continue;
    const enPuente =
      f.cuentaId === CUENTAS_SISTEMA.porAsignar || f.cuentaId === CUENTAS_SISTEMA.porAsignarEntradas;
    // Una puente solo cuenta en su sentido: las salidas en `por_asignar`, las entradas en `por_asignar_entradas`.
    if (f.cuentaId === CUENTAS_SISTEMA.porAsignar && f.monto > 0) continue;
    if (f.cuentaId === CUENTAS_SISTEMA.porAsignarEntradas && f.monto < 0) continue;
    vistos.add(f.id);
    const deudaTarjeta = f.cuentaId === tarjeta ? -f.monto : 0;
    salida.push({
      id: f.id,
      cuenta: enPuente
        ? f.cuentaId === CUENTAS_SISTEMA.porAsignar
          ? CUENTA_POR_ASIGNAR
          : CUENTA_POR_ASIGNAR_ENTRADAS
        : f.cuentaId,
      cuentaRaiz: enPuente ? undefined : tarjeta,
      monto: Math.abs(f.monto),
      fecha: f.fecha,
      comercio: f.comercio,
      tipo: f.tipo,
      // Sobre la tarjeta o su subcuenta, un asiento negativo sube la deuda; en `por_asignar` es una salida.
      sentido: f.monto < 0 ? 'salida' : 'entrada',
      descripcion: f.comercio ?? f.descripcion,
      deudaTarjeta,
    });
  }
  return salida;
}

/** Slug de la categoría con que se guardaría un cargo: regla aprendida o catálogo (`07 §6`), si no, otros gastos. */
function categoriaDe(ctx: Contexto, m: MovimientoEstado): string | null {
  if (m.tipo === 'comision') return 'comisiones_intereses';
  if (m.tipo !== 'cargo') return null;
  return internos.categoriaDeComercio(ctx, m.descripcion) ?? 'otros_gastos';
}

interface Plan {
  readonly estado: EstadoCuentaLeido;
  readonly tarjeta: TarjetaLeida;
  readonly decisiones: readonly DecisionRenglon[];
  readonly existentes: readonly Candidato[];
  readonly revisados: Map<number, string | null>;
}

type Preparacion = Exclude<LecturaEstadoCuenta, { tipo: 'listo' }> | { tipo: 'plan'; plan: Plan };

function preparar(ctx: Contexto, paginas: readonly string[], opciones: OpcionesEstado): Preparacion {
  const catalogo = opciones.catalogo ?? catalogoAnalizadoresApp();
  const lectura = leerEstadoCuentaPdf(paginas, catalogo);
  if (lectura.tipo === 'escaneado') return { tipo: 'escaneado' };
  if (lectura.tipo === 'no_reconocido')
    return { tipo: 'no_reconocido', bancos: bancosConAnalizador(catalogo) };
  if (lectura.tipo === 'incompleto') {
    const banco = catalogo.analizadores.find((a) => a.id === lectura.analizador)?.nombre ?? '';
    return { tipo: 'incompleto', banco };
  }
  const e = lectura.estado;
  const tarjetas = tarjetasActivas(ctx);
  if (tarjetas.length === 0) return { tipo: 'sin_tarjetas', banco: e.nombreBanco };
  let tarjeta: TarjetaLeida | undefined;
  if (opciones.tarjetaId !== undefined) {
    tarjeta = tarjetas.find((t) => t.cuentaId === opciones.tarjetaId);
    if (!tarjeta) throw new ErrorDominio('tarjeta_inexistente', 'esa tarjeta no existe');
  } else {
    const posibles = tarjetasPosibles(tarjetas, e);
    if (posibles.length === 1) tarjeta = posibles[0];
  }
  if (!tarjeta) {
    return {
      tipo: 'elegir_tarjeta',
      banco: e.nombreBanco,
      ultimos4: e.ultimos4,
      corte: e.corte,
      tarjetas: tarjetas.map(aTarjetaEstado),
    };
  }
  if (e.corte < tarjeta.alta)
    return { tipo: 'anterior_al_alta', tarjeta: aTarjetaEstado(tarjeta), corte: e.corte };

  const fechas = e.movimientos.map((m) => m.fecha);
  const desde = sumarDias([e.periodo?.desde ?? e.corte, ...fechas].sort()[0] as PlainDate, -2);
  const hasta = sumarDias([e.corte, ...fechas].sort().at(-1) as PlainDate, 2);
  const existentes = candidatos(ctx, tarjeta.cuentaId, desde, hasta);
  const revisados = renglonesRevisados(ctx, tarjeta.cuentaId, e.corte);
  const decisiones = completarConEstado({
    tarjeta: tarjeta.cuentaId,
    movimientos: e.movimientos,
    existentes,
    revisados: new Set(revisados.keys()),
    alta: tarjeta.alta,
  });
  return { tipo: 'plan', plan: { estado: e, tarjeta, decisiones, existentes, revisados } };
}

/**
 * Deuda comparable al corte (`deudaComparableAlCorte`): `vinculados` son los movimientos del libro que
 * corresponden a renglones (con su efecto en la deuda de la tarjeta ya como quedarán), `agregada` lo que los
 * renglones nuevos sumarán a la deuda al corte.
 */
function deudaCartera(
  ctx: Contexto,
  tarjeta: string,
  corte: PlainDate,
  vinculados: ReadonlyMap<string, { fecha: PlainDate; deuda: Centavos }>,
  agregada: Centavos,
): Centavos {
  const cerca = candidatos(ctx, tarjeta, sumarDias(corte, -DIAS_EN_CAMINO), corte).filter(
    (c) => !vinculados.has(c.id) && c.deudaTarjeta !== 0,
  );
  return deudaComparableAlCorte({
    corte,
    deudaLibroAlCorte: -ctx.libro.saldo(tarjeta, corte) + agregada,
    vinculados: [...vinculados.values()],
    sinRenglonCercaDelCorte: cerca.map((c) => ({ fecha: c.fecha, deuda: c.deudaTarjeta })),
  });
}

/** Fecha y efecto en la deuda de la tarjeta de los movimientos ya vinculados a renglones del estado. */
function vinculadosDe(
  ctx: Contexto,
  tarjeta: string,
  ids: Iterable<string | null>,
): Map<string, { fecha: PlainDate; deuda: Centavos }> {
  const salida = new Map<string, { fecha: PlainDate; deuda: Centavos }>();
  for (const tx of ids) {
    const fila = tx === null ? null : ctx.libro.obtener(tx);
    if (tx === null || !fila) continue;
    const deuda = -fila.asientos.filter((a) => a.cuentaId === tarjeta).reduce((s, a) => s + a.monto, 0);
    salida.set(tx, { fecha: fila.fecha, deuda });
  }
  return salida;
}

function renglon(ctx: Contexto, m: MovimientoEstado): RenglonEstado {
  return { ...m, categoria: categoriaDe(ctx, m) };
}

/**
 * Lee el estado de cuenta (`02 §26`): reconoce el banco, busca la tarjeta y separa lo que ya tenías, lo que no y
 * lo dudoso (E9.3), con el saldo al corte del banco contra el de Cartera si guardas lo nuevo. No escribe nada,
 * salvo cerrar los cortes pendientes (lo mismo que hace la app al abrir).
 */
export function analizarEstadoCuentaPdf(
  ctx: Contexto,
  paginas: readonly string[],
  opciones: OpcionesEstado = {},
): LecturaEstadoCuenta {
  procesarCortes(ctx);
  const p = preparar(ctx, paginas, opciones);
  if (p.tipo !== 'plan') return p;
  const { estado: e, tarjeta, decisiones, existentes } = p.plan;
  const porIndice = new Map(e.movimientos.map((m) => [m.indice, m]));
  const porId = new Map(existentes.map((x) => [x.id, x]));
  const nuevos: RenglonEstado[] = [];
  const dudosos: RenglonDudoso[] = [];
  let yaLosTenias = 0;
  let anteriores = 0;
  let agregada = 0;
  const vinculados = vinculadosDe(ctx, tarjeta.cuentaId, p.plan.revisados.values());
  for (const d of decisiones) {
    const m = porIndice.get(d.indice) as MovimientoEstado;
    if (d.decision === 'revisado' || d.decision === 'existente') yaLosTenias++;
    if (d.decision === 'anterior') anteriores++;
    if (d.decision === 'nuevo') {
      nuevos.push(renglon(ctx, m));
      if (m.fecha <= e.corte) agregada += deudaDeMovimiento(m);
    }
    if (d.decision === 'existente' || d.decision === 'dudoso') {
      const x = porId.get(d.transaccion) as Candidato;
      // Lo que estaba en una cuenta puente pasa a la tarjeta con su fecha.
      const deuda = d.puente ? deudaDeMovimiento(m) : x.deudaTarjeta;
      if (d.puente && x.fecha <= e.corte) agregada += deuda;
      vinculados.set(x.id, { fecha: x.fecha, deuda });
    }
    if (d.decision === 'dudoso') {
      const x = porId.get(d.transaccion) as Candidato;
      dudosos.push({
        ...renglon(ctx, m),
        transaccionId: x.id,
        existente: { fecha: x.fecha, descripcion: x.descripcion, monto: x.monto },
      });
    }
  }
  const saldoCartera = deudaCartera(ctx, tarjeta.cuentaId, e.corte, vinculados, agregada);
  return {
    tipo: 'listo',
    analisis: {
      tarjeta: aTarjetaEstado(tarjeta),
      banco: e.nombreBanco,
      corte: e.corte,
      limite: e.limite,
      total: e.movimientos.length,
      yaLosTenias,
      nuevos,
      dudosos,
      anteriores,
      renglonesSinLeer: e.renglonesSinLeer,
      cuadra: e.cuadra,
      saldoBanco: e.saldoCorte,
      saldoCartera,
      coincide: saldoCartera === e.saldoCorte,
    },
  };
}

// ——— Guardar ———

export interface DecisionesEstado {
  /** La tarjeta del análisis. */
  readonly tarjetaId: string;
  /** Índices de los renglones nuevos que la persona quitó de la lista. */
  readonly omitir?: readonly number[] | undefined;
  /** Respuesta a cada dudoso: `mismo` (ya lo tenía) u `otro` (agregarlo). Sin respuesta no se guarda. */
  readonly dudosos?: Readonly<Record<number, 'mismo' | 'otro'>> | undefined;
}

/** "Según tu banco debes $4,350; según Cartera, $4,200. ¿Ajusto?" (`02 §26`). */
export interface PropuestaConciliacionEstado {
  readonly tarjetaId: string;
  readonly nombreTarjeta: string;
  readonly corte: PlainDate;
  readonly saldoBanco: Centavos;
  readonly saldoCartera: Centavos;
}

export interface ResultadoGuardarEstado {
  readonly agregados: number;
  /** `null` si el saldo al corte coincide. */
  readonly conciliacion: PropuestaConciliacionEstado | null;
}

function registroDeRenglon(
  ctx: Contexto,
  tarjeta: string,
  m: MovimientoEstado,
): { mov: MovimientoPropuesto; comercio: string } {
  switch (m.tipo) {
    case 'cargo':
    case 'comision':
      return {
        mov: construirGasto({
          categoria: idCategoria(categoriaDe(ctx, m) as string),
          pago: tarjeta,
          monto: m.monto,
        }),
        comercio: m.descripcion,
      };
    case 'pago':
      // Caso 17: un pago que la captura no vio. El tránsito negativo resta de lo libre hasta ver de dónde salió
      // (regla 12: nunca se supone que el dinero vino de fuera).
      return {
        mov: construirPagoRecibidoPendiente({ tarjeta, transito: CUENTAS_SISTEMA.transito, monto: m.monto }),
        comercio: m.descripcion,
      };
    case 'abono': {
      // Devolución o bonificación (caso 21): contra la categoría del cargo original si se encuentra.
      const d: DatosCaptura = {
        tipo: 'devolucion',
        banco: null,
        plantilla: null,
        fecha: m.fecha,
        cuando: 0,
        comercio: m.descripcion,
      };
      return { mov: internos.registroDevolucion(ctx, d, tarjeta, m.monto).mov, comercio: m.descripcion };
    }
  }
}

/** Lo que estaba en una cuenta puente pasa a la tarjeta (E9.3 fusionar), conservando lo dictado. */
function moverDePuente(ctx: Contexto, transaccionId: string, tarjeta: string, clave: string): string {
  const fila = ctx.db.select().from(tv).where(eq(tv.id, transaccionId)).get();
  if (!fila) throw new ErrorDominio('movimiento_inexistente', 'ese movimiento ya no está');
  const puentes: string[] = [CUENTAS_SISTEMA.porAsignar, CUENTAS_SISTEMA.porAsignarEntradas];
  const asientos = internos.asientosDe(ctx, transaccionId).map((a) => ({
    cuentaId: puentes.includes(a.cuentaId) ? tarjeta : a.cuentaId,
    monto: a.monto,
  }));
  const nueva: TransaccionNueva = {
    tipo: fila.tipo as TransaccionNueva['tipo'],
    fecha: fila.fecha,
    origen: fila.origen as TransaccionNueva['origen'],
    claveIdempotencia: clave,
    asientos,
    descripcion: fila.descripcion,
    comercio: fila.comercio,
    estimada: fila.estimada === 1,
    extraordinaria: fila.extraordinaria === 1,
    porRevisar: fila.porRevisar === 1,
    meta: fila.meta,
  };
  const r = ctx.libro.reemplazar(transaccionId, nueva);
  // Como al fusionar una captura (E9.3): lo que cubría vuelve a pendiente y el reemplazo lo vuelve a cubrir.
  liberarOcurrencias(ctx, transaccionId);
  trasRegistrar(ctx, r.nueva.id);
  return r.nueva.id;
}

/**
 * Guarda lo decidido (`02 §26` → Guardar), en una transacción SQLite: agrega los renglones nuevos (menos los
 * omitidos) y los dudosos que no eran el mismo, pasa a la tarjeta lo que estaba en una cuenta puente y marca cada
 * renglón como revisado (volver a compartir el mismo PDF no duplica nada). Devuelve la conciliación a proponer si
 * el saldo al corte no coincide.
 */
export function guardarEstadoCuenta(
  ctx: Contexto,
  paginas: readonly string[],
  decisiones: DecisionesEstado,
  opciones: Omit<OpcionesEstado, 'tarjetaId'> = {},
): ResultadoGuardarEstado {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    procesarCortes(ctx);
    const p = preparar(ctx, paginas, { ...opciones, tarjetaId: decisiones.tarjetaId });
    if (p.tipo !== 'plan')
      throw new ErrorDominio('estado_cuenta_invalido', 'no pude leer ese estado de cuenta');
    const { estado: e, tarjeta } = p.plan;
    const omitir = new Set(decisiones.omitir ?? []);
    const porIndice = new Map(e.movimientos.map((m) => [m.indice, m]));
    let agregados = 0;
    let primeraFecha: PlainDate = e.corte;
    for (const d of p.plan.decisiones) {
      if (d.decision === 'revisado' || d.decision === 'anterior') continue;
      const m = porIndice.get(d.indice) as MovimientoEstado;
      const respuesta = d.decision === 'dudoso' ? decisiones.dudosos?.[d.indice] : undefined;
      if (d.decision === 'dudoso' && respuesta === undefined) {
        throw new ErrorDominio('dudosos_sin_respuesta', 'contesta si cada movimiento dudoso ya lo tenías');
      }
      const capturaId = ctx.generarId();
      const clave = `estado_cuenta:${tarjeta.cuentaId}:${e.corte}:${d.indice}`;
      let tx: string | null = null;
      let decision: z.infer<typeof DatosRenglon>['decision'];
      if (d.decision === 'existente' || (d.decision === 'dudoso' && respuesta === 'mismo')) {
        tx = d.puente
          ? moverDePuente(ctx, d.transaccion, tarjeta.cuentaId, `${clave}:puente`)
          : d.transaccion;
        decision = 'existente';
      } else if (d.decision === 'nuevo' && omitir.has(d.indice)) {
        decision = 'omitido';
      } else {
        const r = registroDeRenglon(ctx, tarjeta.cuentaId, m);
        tx = ctx.libro.registrar({
          tipo: r.mov.tipo,
          fecha: m.fecha,
          origen: 'estado_cuenta',
          claveIdempotencia: clave,
          asientos: r.mov.asientos,
          comercio: r.comercio,
          meta: JSON.stringify({ captura: capturaId }),
        }).transaccion.id;
        trasRegistrar(ctx, tx);
        agregados++;
        decision = 'agregado';
      }
      if (m.fecha < primeraFecha) primeraFecha = m.fecha;
      ctx.db
        .insert(captura)
        .values({
          id: capturaId,
          fuente: 'estado_cuenta',
          recibidaEn: ctx.reloj.ahora(),
          origenApp: null,
          textoCrudo: null,
          plantillaId: e.analizador,
          datos: JSON.stringify(
            DatosRenglon.parse({
              tarjeta: tarjeta.cuentaId,
              corte: e.corte,
              indice: d.indice,
              analizador: e.analizador,
              decision,
            }),
          ),
          huella: HUELLA(tarjeta.cuentaId, e.corte, d.indice),
          estado: decision === 'omitido' ? 'descartada' : 'vinculada',
          transaccionId: tx,
        })
        .run();
    }
    // Lo agregado antes de un corte ya cerrado cambia lo que el banco facturó en ese corte.
    recalcularCortesDesde(ctx, tarjeta.cuentaId, primeraFecha);
    return { agregados, conciliacion: propuestaConciliacion(ctx, tarjeta, e.corte, e.saldoCorte) };
  });
}

function propuestaConciliacion(
  ctx: Contexto,
  tarjeta: TarjetaLeida,
  corte: PlainDate,
  saldoBanco: Centavos,
): PropuestaConciliacionEstado | null {
  const vinculados = vinculadosDe(
    ctx,
    tarjeta.cuentaId,
    renglonesRevisados(ctx, tarjeta.cuentaId, corte).values(),
  );
  const saldoCartera = deudaCartera(ctx, tarjeta.cuentaId, corte, vinculados, 0);
  if (saldoCartera === saldoBanco) return null;
  return { tarjetaId: tarjeta.cuentaId, nombreTarjeta: tarjeta.nombre, corte, saldoBanco, saldoCartera };
}

/**
 * "¿Ajusto?" → Sí (`02 §26`, caso 22): una `conciliacion` fechada al corte por la diferencia, para que al corte la
 * tarjeta diga lo mismo que el banco. Idempotente por tarjeta y corte; se recalcula el saldo de ese corte.
 */
export function ajustarSaldoConEstado(ctx: Contexto, p: PropuestaConciliacionEstado): string | null {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const tarjeta = tarjetasActivas(ctx).find((t) => t.cuentaId === p.tarjetaId);
    if (!tarjeta) throw new ErrorDominio('tarjeta_inexistente', 'esa tarjeta no existe');
    // Se vuelve a calcular: si algo cambió desde la propuesta, se ajusta lo que difiere hoy.
    const actual = propuestaConciliacion(ctx, tarjeta, p.corte, p.saldoBanco);
    if (actual === null) return null;
    const saldoLibro = ctx.libro.saldo(p.tarjetaId, p.corte);
    const m = construirConciliacion({
      cuenta: p.tarjetaId,
      capital: CUENTAS_SISTEMA.ajusteConciliacion,
      saldoLibro,
      // La deuda al corte debe subir (o bajar) exactamente lo que difiere del banco.
      saldoReal: saldoLibro - (actual.saldoBanco - actual.saldoCartera),
    });
    const { transaccion } = ctx.libro.registrar({
      tipo: m.tipo,
      fecha: p.corte,
      origen: 'estado_cuenta',
      claveIdempotencia: `estado_cuenta:${p.tarjetaId}:${p.corte}:conciliacion`,
      asientos: m.asientos,
    });
    recalcularCortesDesde(ctx, p.tarjetaId, p.corte);
    return transaccion.id;
  });
}
