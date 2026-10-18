/**
 * De captura a movimiento (`07 §5`, `03 §5.2`): cada notificación interpretada crea una fila `captura` (con su
 * huella, `07 §2.4`) y sigue, dentro de una transacción SQLite, los pasos 1 a 5: cuenta, pareja de
 * transferencia (E9.4), duplicado (E9.3), registro y ocurrencias (E3.5).
 *
 * Regla 9: nada de aquí escribe en logs. Los errores de dominio solo nombran códigos; el texto de la
 * notificación vive únicamente en `captura.texto_crudo` (cifrado, 30 días, `04 §6`).
 */
import { and, asc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  CUENTA_POR_ASIGNAR,
  CUENTA_POR_ASIGNAR_ENTRADAS,
  categorizarComercio,
  construirCobroPrestamo,
  construirGasto,
  construirIngreso,
  construirPagoRecibidoPendiente,
  construirPagoTarjeta,
  construirReembolso,
  construirRetiroEfectivo,
  construirSalidaPendiente,
  construirTransferencia,
  elegirMovimiento,
  emparejarTransferencias,
  ErrorDominio,
  esFecha,
  interpretarNotificacion,
  normalizarComercio,
  similitud,
  sumarDias,
  TIPOS_PLANTILLA,
  type CapturaTransferencia,
  type CatalogoPlantillas,
  type Centavos,
  type MovimientoDedup,
  type MovimientoPropuesto,
  type PlainDate,
  type Sentido,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, idCategoria, type TransaccionNueva } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { categoriaAprendida } from './aprendizaje';
import { cuentaPorId, type FilaCuenta } from './catalogo';
import { ingresoQueCubriria, liberarOcurrencias } from './cobertura';
import { enTransaccion, type Contexto } from './contexto';
import { trasRegistrar } from './formulario';
import { listarPersonas } from './personas';

const { captura, transaccion, transaccionVigente: tv, asiento, cuenta, auditoria } = esquema;

/** Ventana de E9.4: capturas sin pareja de las últimas 24 h (`07 §5` paso 2). */
export const VENTANA_PAREJA_MS = 24 * 60 * 60 * 1000;
/** Un cargo capturado en tarjeta de crédito de $1,000 o más pregunta "¿Fue a meses?" (RF-CAP-08). */
export const UMBRAL_FUE_A_MESES: Centavos = 100_000;
/** El texto crudo de toda captura se borra a los 30 días (`04 §6`). */
export const RETENCION_TEXTO_MS = 30 * 24 * 60 * 60 * 1000;
/** Ventana de búsqueda del cargo original de una devolución (`07 §5`). */
export const DIAS_DEVOLUCION = 60;

const TIPOS_DATOS = [...TIPOS_PLANTILLA, 'no_reconocida'] as const;
export type TipoCaptura = (typeof TIPOS_DATOS)[number];

/** Por qué una captura vinculada está en "Por revisar" (`transaccion.meta.revisar`). */
export const MOTIVOS_REVISAR = [
  'fue_a_meses',
  'sin_categoria',
  'ingreso',
  'cobro',
  'disposicion',
  'pregunta_24h',
] as const;
export type MotivoRevisar = (typeof MOTIVOS_REVISAR)[number];

const Espera = z.discriminatedUnion('tipo', [
  /** Paso 1 sin cuenta: tarjeta nueva detectada o varias cuentas posibles (RF-CAP-03). */
  z.strictObject({ tipo: z.literal('cuenta'), candidatas: z.array(z.string()) }),
  /** E9.3 `preguntar`: "¿Es el mismo movimiento?". */
  z.strictObject({ tipo: z.literal('duplicado'), transaccion_id: z.string() }),
]);
export type EsperaCaptura = z.infer<typeof Espera>;

/** `captura.datos` (`04 §3`): lo interpretado más el estado del flujo. */
export const DatosCaptura = z.strictObject({
  tipo: z.enum(TIPOS_DATOS),
  banco: z.string().nullable(),
  plantilla: z.string().nullable(),
  monto: z.int().min(1).optional(),
  comercio: z.string().optional(),
  ultimos4: z.string().optional(),
  contraparte: z.string().optional(),
  destino4: z.string().optional(),
  fecha: z.string().refine(esFecha),
  /** `cuando` efectivo en ms UTC (`07 §2.4`). */
  cuando: z.number(),
  cuenta_id: z.string().optional(),
  espera: Espera.optional(),
  /** Id de la otra mitad (E9.4) o `respondida` tras la pregunta de las 24 h. */
  pareja: z.string().optional(),
  /** Movimiento dictado con el que se fusionó (E9.3). */
  dictado: z.string().optional(),
  /** E9.3 contestado: no volver a preguntar. */
  duplicado: z.enum(['mismo', 'otro']).optional(),
  /** No reconocida ya atendida ("Ya la registré" / "Descartar"). */
  revisada: z.boolean().optional(),
});
export type DatosCaptura = z.infer<typeof DatosCaptura>;

export type EstadoCaptura = (typeof captura.$inferSelect)['estado'];

/** Lo que llega de la ingesta (ya con huella y con el paquete de depuración resuelto). */
export interface CapturaEntrante {
  readonly huella: string;
  /** Paquete efectivo (tras el mapeo de `adb` en depuración). */
  readonly paquete: string;
  readonly cuando: number;
  readonly titulo: string | null;
  readonly texto: string | null;
}

export interface ResultadoCaptura {
  readonly capturaId: string;
  /** `false` si la huella ya existía (la misma notificación otra vez): no se escribió nada. */
  readonly nueva: boolean;
  readonly estado: EstadoCaptura;
  readonly transaccionId: string | null;
  readonly espera: EsperaCaptura['tipo'] | null;
  /** Id del banco en el catálogo de plantillas (`null` si el paquete no es de ningún banco). */
  readonly banco: string | null;
  /** Alguna plantilla la entendió (`false` = `no_reconocida`). */
  readonly reconocida: boolean;
}

export interface CapturaLeida {
  readonly id: string;
  readonly estado: EstadoCaptura;
  readonly transaccionId: string | null;
  readonly recibidaEn: number;
  readonly texto: { readonly titulo: string | null; readonly texto: string | null } | null;
  readonly datos: DatosCaptura;
}

const TextoCrudo = z.strictObject({ titulo: z.string().nullable(), texto: z.string().nullable() });

// ——— Lectura y escritura de capturas ———

export function leerCaptura(ctx: Contexto, id: string): CapturaLeida {
  const f = ctx.db.select().from(captura).where(eq(captura.id, id)).get();
  if (!f) throw new ErrorDominio('captura_inexistente', 'esa captura no existe');
  return aCaptura(f);
}

function aCaptura(f: typeof captura.$inferSelect): CapturaLeida {
  const datos = DatosCaptura.safeParse(JSON.parse(f.datos ?? 'null'));
  if (!datos.success) throw new ErrorDominio('captura_invalida', 'los datos de la captura no son válidos');
  let texto: CapturaLeida['texto'] = null;
  if (f.textoCrudo !== null) {
    const t = TextoCrudo.safeParse(JSON.parse(f.textoCrudo));
    texto = t.success ? t.data : null;
  }
  return {
    id: f.id,
    estado: f.estado,
    transaccionId: f.transaccionId,
    recibidaEn: f.recibidaEn,
    texto,
    datos: datos.data,
  };
}

/** Capturas de notificación con estado en `estados`, por `cuando` y luego por llegada. */
export function capturasEn(ctx: Contexto, estados: readonly EstadoCaptura[]): CapturaLeida[] {
  return ctx.db
    .select()
    .from(captura)
    .where(and(eq(captura.fuente, 'notificacion'), inArray(captura.estado, [...estados])))
    .orderBy(asc(captura.recibidaEn), asc(captura.id))
    .all()
    .map(aCaptura)
    .sort((a, b) => a.datos.cuando - b.datos.cuando);
}

function guardar(
  ctx: Contexto,
  id: string,
  cambios: { estado: EstadoCaptura; datos: DatosCaptura; transaccionId?: string | null },
): void {
  ctx.db
    .update(captura)
    .set({
      estado: cambios.estado,
      datos: JSON.stringify(DatosCaptura.parse(cambios.datos)),
      ...(cambios.transaccionId !== undefined ? { transaccionId: cambios.transaccionId } : {}),
    })
    .where(eq(captura.id, id))
    .run();
}

/**
 * La versión vigente de una transacción: ella misma si no está anulada, o la que la reemplazó (siguiendo
 * `reemplaza_a` hacia adelante: correcciones, pasar a meses, pares de E9.4). `null` si se anuló sin reemplazo.
 */
export function vigenteDe(ctx: Contexto, id: string | null): string | null {
  let actual = id;
  const vistos = new Set<string>();
  while (actual !== null && !vistos.has(actual)) {
    vistos.add(actual);
    const anulada = ctx.db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.revierteA, actual))
      .get();
    if (!anulada) return actual;
    const siguiente = ctx.db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.reemplazaA, actual))
      .get();
    actual = siguiente?.id ?? null;
  }
  return null;
}

/** Borra el texto crudo de las capturas con más de 30 días (`04 §6`); conserva `datos`. Idempotente. */
export function purgarTextosCaptura(ctx: Contexto): void {
  ctx.db
    .update(captura)
    .set({ textoCrudo: null })
    .where(
      and(isNotNull(captura.textoCrudo), lte(captura.recibidaEn, ctx.reloj.ahora() - RETENCION_TEXTO_MS)),
    )
    .run();
}

// ——— Ingesta de una captura ———

/**
 * Registra una notificación ya con huella (`07 §2.4`, CA-M5-10): si la huella existe no hace nada; si no,
 * aplica las plantillas (`07 §3`), crea la fila `captura` y sigue los pasos de `07 §5` en una sola transacción
 * SQLite. Un error de dominio deja la captura en `error` (sin texto en ningún log) para no reintentarla sin fin.
 */
export function registrarCaptura(
  ctx: Contexto,
  entrante: CapturaEntrante,
  catalogo: CatalogoPlantillas,
): ResultadoCaptura {
  exigirConsentimiento(ctx);
  const previa = ctx.db
    .select()
    .from(captura)
    .where(and(eq(captura.fuente, 'notificacion'), eq(captura.huella, entrante.huella)))
    .get();
  if (previa) return resultado(ctx, previa.id, false);

  const id = ctx.generarId();
  const interpretacion = interpretarNotificacion(
    { paquete: entrante.paquete, titulo: entrante.titulo, texto: entrante.texto },
    catalogo,
  );
  const datos: DatosCaptura = {
    tipo: interpretacion.tipo,
    banco: interpretacion.banco,
    plantilla: interpretacion.plantilla,
    ...(interpretacion.monto !== undefined ? { monto: interpretacion.monto } : {}),
    ...(interpretacion.comercio ? { comercio: interpretacion.comercio } : {}),
    ...(interpretacion.ultimos4 ? { ultimos4: interpretacion.ultimos4 } : {}),
    ...(interpretacion.contraparte ? { contraparte: interpretacion.contraparte } : {}),
    ...(interpretacion.destino4 ? { destino4: interpretacion.destino4 } : {}),
    fecha: ctx.reloj.fechaDe?.(entrante.cuando) ?? ctx.reloj.hoy(),
    cuando: entrante.cuando,
  };
  const fila = {
    id,
    fuente: 'notificacion' as const,
    recibidaEn: ctx.reloj.ahora(),
    origenApp: entrante.paquete,
    textoCrudo: JSON.stringify({ titulo: entrante.titulo, texto: entrante.texto }),
    plantillaId: interpretacion.plantilla,
    datos: JSON.stringify(datos),
    huella: entrante.huella,
  };
  try {
    enTransaccion(ctx, () => {
      ctx.db
        .insert(captura)
        .values({ ...fila, estado: 'interpretada' })
        .run();
      avanzar(ctx, id);
    });
  } catch (error) {
    if (!(error instanceof ErrorDominio)) throw error;
    ctx.db
      .insert(captura)
      .values({ ...fila, estado: 'error' })
      .run();
  }
  return resultado(ctx, id, true);
}

function resultado(ctx: Contexto, id: string, nueva: boolean): ResultadoCaptura {
  const c = leerCaptura(ctx, id);
  return {
    capturaId: id,
    nueva,
    estado: c.estado,
    transaccionId: c.transaccionId,
    espera: c.estado === 'interpretada' ? (c.datos.espera?.tipo ?? null) : null,
    banco: c.datos.banco,
    reconocida: c.datos.tipo !== 'no_reconocida',
  };
}

/** Sentido del dinero para E9.3; `null` si el tipo no se compara con movimientos dictados. */
function sentidoDe(tipo: TipoCaptura): Sentido | null {
  if (tipo === 'cargo' || tipo === 'retiro' || tipo === 'transferencia_enviada') return 'salida';
  if (tipo === 'transferencia_recibida' || tipo === 'devolucion' || tipo === 'cobro_recibido')
    return 'entrada';
  return null;
}

const ES_TRANSFERENCIA = new Set<TipoCaptura>([
  'transferencia_enviada',
  'transferencia_recibida',
  'pago_recibido_tarjeta',
]);

/**
 * Pasos de `07 §5` para una captura que todavía no tiene movimiento (recién llegada, o tras contestar una
 * pregunta o dar de alta su cuenta). Corre dentro de la transacción del llamador.
 */
export function avanzar(ctx: Contexto, capturaId: string): void {
  const c = leerCaptura(ctx, capturaId);
  const d = c.datos;
  if (c.estado !== 'interpretada') return;
  if (d.tipo === 'ignorar') {
    guardar(ctx, c.id, { estado: 'descartada', datos: d });
    return;
  }
  if (d.tipo === 'no_reconocida' || d.monto === undefined) {
    guardar(ctx, c.id, { estado: 'no_reconocida', datos: d });
    return;
  }

  // 1. Cuenta.
  if (d.cuenta_id === undefined) {
    const r = resolverCuenta(ctx, d);
    if (r.tipo === 'espera') {
      guardar(ctx, c.id, { estado: 'interpretada', datos: { ...d, espera: r.espera } });
      return;
    }
    d.cuenta_id = r.cuentaId;
  }
  delete d.espera;
  const conCuenta = { ...c, datos: d };

  // E9.3 se decide antes de la pareja: una pregunta pendiente detiene también a la pareja (`07 §5` paso 2).
  const duplicado = buscarDuplicado(ctx, conCuenta);
  if (duplicado?.decision === 'preguntar') {
    guardar(ctx, c.id, {
      estado: 'interpretada',
      datos: { ...d, espera: { tipo: 'duplicado', transaccion_id: duplicado.transaccionId } },
    });
    return;
  }
  const fusion = duplicado?.decision === 'fusionar' ? duplicado.transaccionId : null;

  // 2. Pareja de transferencia (E9.4).
  if (ES_TRANSFERENCIA.has(d.tipo) && intentarPareja(ctx, conCuenta, fusion)) return;

  // 3. Duplicado: fusionar con lo dictado.
  if (fusion !== null) {
    fusionar(ctx, conCuenta, fusion);
    return;
  }

  // 4 y 5. Registro según el tipo y ocurrencias.
  const tx = registrarSegunTipo(ctx, conCuenta);
  guardar(ctx, c.id, { estado: 'vinculada', datos: d, transaccionId: tx });
  trasRegistrar(ctx, tx);
}

// ——— Paso 1: cuenta ———

type ResolucionCuenta =
  { tipo: 'ok'; cuentaId: string } | { tipo: 'espera'; espera: Extract<EsperaCaptura, { tipo: 'cuenta' }> };

const SUBTIPOS_CAPTURA = ['debito', 'billetera', 'tarjeta_credito', 'efectivo', 'ahorro'] as const;

function cuentasCandidatas(ctx: Contexto): FilaCuenta[] {
  return ctx.db
    .select()
    .from(cuenta)
    .where(
      and(
        eq(cuenta.espacio, 'personal'),
        eq(cuenta.sistema, 0),
        eq(cuenta.archivada, 0),
        inArray(cuenta.subtipo, [...SUBTIPOS_CAPTURA]),
        inArray(cuenta.naturaleza, ['activo', 'pasivo']),
      ),
    )
    .orderBy(asc(cuenta.creadaEn), asc(cuenta.id))
    .all();
}

/**
 * `07 §5` paso 1: por últimos 4 (una cuenta de otra institución no cuenta); sin últimos 4, la única cuenta de
 * esa institución. Si no hay cuenta, la captura queda en espera y se propone crearla (RF-CAP-03); con varias
 * posibles se pregunta cuál.
 */
function resolverCuenta(ctx: Contexto, d: DatosCaptura): ResolucionCuenta {
  const todas = cuentasCandidatas(ctx).filter((c) => c.subtipo !== 'efectivo');
  const deMiBanco = (c: FilaCuenta) => c.institucion === null || c.institucion === d.banco;
  let candidatas: FilaCuenta[];
  if (d.ultimos4 !== undefined) {
    candidatas = todas.filter((c) => c.ultimos4 === d.ultimos4 && deMiBanco(c));
    const exactas = candidatas.filter((c) => c.institucion === d.banco);
    if (exactas.length === 1) candidatas = exactas;
    if (candidatas.length === 1 && candidatas[0]) return { tipo: 'ok', cuentaId: candidatas[0].id };
    return { tipo: 'espera', espera: { tipo: 'cuenta', candidatas: candidatas.map((c) => c.id) } };
  }
  candidatas = todas.filter((c) => d.banco !== null && c.institucion === d.banco);
  if (candidatas.length === 1 && candidatas[0]) return { tipo: 'ok', cuentaId: candidatas[0].id };
  // Sin institución conocida: se pregunta entre las cuentas que podrían ser (las de ese banco o sin banco).
  const posibles = candidatas.length > 1 ? candidatas : todas.filter((c) => c.institucion === null);
  return { tipo: 'espera', espera: { tipo: 'cuenta', candidatas: posibles.map((c) => c.id) } };
}

/** La cuenta de efectivo del espacio personal (destino de un retiro). */
export function cuentaEfectivo(ctx: Contexto): FilaCuenta | null {
  return cuentasCandidatas(ctx).find((c) => c.subtipo === 'efectivo') ?? null;
}

// ——— Paso 3: duplicados contra lo dictado (E9.3) ———

const ORIGENES_DICTADOS = ['voz', 'texto', 'manual'] as const;
const TIPOS_NO_COMPARABLES = new Set<string>([
  'saldo_inicial',
  'conciliacion',
  'reversa',
  'reclasificacion_msi',
  'liquidacion_msi',
  'ajuste_arqueo',
  'transferencia_pendiente',
]);
const PUENTE_POR_SENTIDO: Record<Sentido, string> = {
  salida: CUENTAS_SISTEMA.porAsignar,
  entrada: CUENTAS_SISTEMA.porAsignarEntradas,
};

interface AsientoConCuenta {
  readonly cuentaId: string;
  readonly monto: Centavos;
  readonly c: FilaCuenta;
}

function asientosDe(ctx: Contexto, transaccionId: string): AsientoConCuenta[] {
  return ctx.db
    .select({ cuentaId: asiento.cuentaId, monto: asiento.monto, c: cuenta })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(eq(asiento.transaccionId, transaccionId))
    .orderBy(asc(asiento.id))
    .all();
}

/** Cuenta "propia" para E9.3: dinero o deuda del usuario, incluidas las puentes (no categorías ni capital). */
function esPropiaODePuente(c: FilaCuenta): boolean {
  if (c.naturaleza !== 'activo' && c.naturaleza !== 'pasivo') return false;
  return c.id !== CUENTAS_SISTEMA.transito && c.id !== CUENTAS_SISTEMA.cuentasExternas;
}

/** Movimientos vigentes ya absorbidos por alguna captura (un movimiento absorbe una por fuente, E9.3). */
function absorbidos(ctx: Contexto): Set<string> {
  const filas = ctx.db
    .select({ tx: captura.transaccionId })
    .from(captura)
    .where(and(eq(captura.fuente, 'notificacion'), isNotNull(captura.transaccionId)))
    .all();
  const ids = new Set<string>();
  for (const f of filas) {
    const v = vigenteDe(ctx, f.tx);
    if (v) ids.add(v);
  }
  return ids;
}

interface Dictado extends MovimientoDedup {
  readonly id: string;
}

function dictadosCandidatos(ctx: Contexto, c: CapturaLeida, sentido: Sentido): Dictado[] {
  const d = c.datos;
  const filas = ctx.db
    .select()
    .from(tv)
    .where(
      and(
        inArray(tv.origen, [...ORIGENES_DICTADOS]),
        gte(tv.fecha, sumarDias(d.fecha, -2)),
        lte(tv.fecha, sumarDias(d.fecha, 2)),
      ),
    )
    .orderBy(asc(tv.registradaEn), asc(tv.id))
    .all()
    .filter((t) => !TIPOS_NO_COMPARABLES.has(t.tipo));
  if (filas.length === 0) return [];
  const yaAbsorbidos = absorbidos(ctx);
  const salida: Dictado[] = [];
  for (const t of filas) {
    if (yaAbsorbidos.has(t.id)) continue;
    const propio = asientosDe(ctx, t.id).find(
      (a) => esPropiaODePuente(a.c) && (sentido === 'salida' ? a.monto < 0 : a.monto > 0),
    );
    if (!propio) continue;
    // Un retiro en cajero no es un gasto dictado sin método: no se fusiona con `por_asignar`.
    if (d.tipo === 'retiro' && propio.cuentaId === PUENTE_POR_SENTIDO.salida) continue;
    const cuentaDedup =
      propio.cuentaId === CUENTAS_SISTEMA.porAsignar
        ? CUENTA_POR_ASIGNAR
        : propio.cuentaId === CUENTAS_SISTEMA.porAsignarEntradas
          ? CUENTA_POR_ASIGNAR_ENTRADAS
          : propio.cuentaId;
    salida.push({
      id: t.id,
      cuenta: cuentaDedup,
      cuentaRaiz: propio.c.padreId ?? cuentaDedup,
      monto: Math.abs(propio.monto),
      fecha: t.fecha,
      comercio: t.comercio,
      tipo: t.tipo,
    });
  }
  return salida;
}

function buscarDuplicado(
  ctx: Contexto,
  c: CapturaLeida,
): { decision: 'fusionar' | 'preguntar'; transaccionId: string } | null {
  const d = c.datos;
  const sentido = sentidoDe(d.tipo);
  if (sentido === null || d.monto === undefined || d.cuenta_id === undefined) return null;
  if (d.duplicado === 'otro') return null;
  if (d.duplicado === 'mismo' && d.dictado) return { decision: 'fusionar', transaccionId: d.dictado };
  const candidatos = dictadosCandidatos(ctx, c, sentido);
  const elegido = elegirMovimiento(
    { cuenta: d.cuenta_id, monto: d.monto, fecha: d.fecha, comercio: d.comercio ?? null, sentido },
    candidatos,
  );
  if (!elegido) return null;
  const mov = candidatos[elegido.indice] as Dictado;
  return {
    decision: elegido.resultado.decision === 'fusionar' ? 'fusionar' : 'preguntar',
    transaccionId: mov.id,
  };
}

/**
 * Fusionar (E9.3): si lo dictado estaba en una cuenta puente (o el monto real es otro), se `reemplaza` con la
 * cuenta y el monto de la captura, conservando descripción, categoría y origen dictados (E9-38); si ya estaba
 * en la cuenta real, la captura solo se vincula.
 */
function fusionar(ctx: Contexto, c: CapturaLeida, dictadoId: string): void {
  const d = c.datos;
  const sentido = sentidoDe(d.tipo) as Sentido;
  const vigente = vigenteDe(ctx, dictadoId);
  if (!vigente || d.monto === undefined || d.cuenta_id === undefined) {
    throw new ErrorDominio('dictado_inexistente', 'el movimiento dictado ya no está');
  }
  const puente = PUENTE_POR_SENTIDO[sentido];
  const asientos = asientosDe(ctx, vigente);
  const propio = asientos.find(
    (a) => esPropiaODePuente(a.c) && (sentido === 'salida' ? a.monto < 0 : a.monto > 0),
  );
  const montoDistinto = propio !== undefined && Math.abs(propio.monto) !== d.monto;
  let final = vigente;
  if (asientos.some((a) => a.cuentaId === puente) || montoDistinto) {
    if (montoDistinto && asientos.length !== 2) {
      throw new ErrorDominio('fusion_no_soportada', 'ese movimiento no se puede corregir así');
    }
    const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, vigente)).get();
    if (!fila) throw new ErrorDominio('dictado_inexistente', 'el movimiento dictado ya no está');
    const nuevos = asientos.map((a) => ({
      cuentaId: a.cuentaId === puente ? (d.cuenta_id as string) : a.cuentaId,
      monto: montoDistinto ? Math.sign(a.monto) * (d.monto as number) : a.monto,
    }));
    const r = ctx.libro.reemplazar(vigente, {
      tipo: fila.tipo as TransaccionNueva['tipo'],
      fecha: fila.fecha,
      origen: fila.origen as TransaccionNueva['origen'],
      claveIdempotencia: `captura:${c.id}:fusion`,
      asientos: nuevos,
      descripcion: fila.descripcion,
      comercio: fila.comercio ?? d.comercio ?? null,
      estimada: fila.estimada === 1,
      extraordinaria: fila.extraordinaria === 1,
      porRevisar: fila.porRevisar === 1,
      meta: fila.meta,
    });
    liberarOcurrencias(ctx, vigente);
    final = r.nueva.id;
    trasRegistrar(ctx, final);
  }
  guardar(ctx, c.id, {
    estado: 'vinculada',
    datos: { ...d, dictado: dictadoId },
    transaccionId: final,
  });
}

// ——— Paso 2: pareja de transferencia (E9.4) ———

function aTransferencia(c: CapturaLeida, ctx: Contexto, yaRegistrada: boolean): CapturaTransferencia {
  const d = c.datos;
  return {
    id: c.id,
    cuenta: d.cuenta_id as string,
    espacio: cuentaPorId(ctx, d.cuenta_id as string).espacio,
    monto: d.monto as Centavos,
    fecha: d.fecha,
    tipo: d.tipo as CapturaTransferencia['tipo'],
    yaRegistrada,
  };
}

/** Capturas del otro lado sin pareja, registradas y con movimiento vigente, a ≤ 24 h de `c` (E9.4). */
function mitadesSinPareja(ctx: Contexto, c: CapturaLeida, lado: 'salida' | 'entrada'): CapturaLeida[] {
  const tipos: TipoCaptura[] =
    lado === 'salida' ? ['transferencia_enviada'] : ['transferencia_recibida', 'pago_recibido_tarjeta'];
  return capturasEn(ctx, ['vinculada']).filter(
    (o) =>
      o.id !== c.id &&
      tipos.includes(o.datos.tipo) &&
      o.datos.pareja === undefined &&
      o.datos.cuenta_id !== undefined &&
      o.datos.monto !== undefined &&
      Math.abs(o.datos.cuando - c.datos.cuando) <= VENTANA_PAREJA_MS &&
      vigenteDe(ctx, o.transaccionId) !== null,
  );
}

/**
 * Corre E9.4 con la captura que llega contra las mitades del otro lado. Si hay pareja, una sola transacción
 * reemplaza lo ya registrado de la otra mitad (y lo dictado con que se fusionó la que llega). Devuelve `true` si
 * formó pareja.
 */
function intentarPareja(ctx: Contexto, c: CapturaLeida, fusion: string | null): boolean {
  const esSalida = c.datos.tipo === 'transferencia_enviada';
  const otras = mitadesSinPareja(ctx, c, esSalida ? 'entrada' : 'salida');
  if (otras.length === 0) return false;
  const yo = aTransferencia(c, ctx, false);
  const ellas = otras.map((o) => aTransferencia(o, ctx, true));
  const [par] = esSalida ? emparejarTransferencias([yo], ellas) : emparejarTransferencias(ellas, [yo]);
  if (!par) return false;
  // Entre espacios (retiro o aportación del dueño) llega con el negocio (M11).
  if (par.movimiento !== 'transferencia' && par.movimiento !== 'pago_tarjeta') return false;
  const otra = otras.find((o) => o.id === (esSalida ? par.entrada : par.salida)) as CapturaLeida;
  const salida = esSalida ? c : otra;
  const entrada = esSalida ? otra : c;
  const reemplazar = [otra.transaccionId, fusion]
    .map((id) => vigenteDe(ctx, id))
    .filter((id): id is string => id !== null);
  aplicarPar(ctx, salida, entrada, reemplazar);
  return true;
}

/** Una sola transacción final para el par: `pago_tarjeta` si la entrada es una tarjeta, si no `transferencia`. */
function aplicarPar(
  ctx: Contexto,
  salida: CapturaLeida,
  entrada: CapturaLeida,
  reemplazar: readonly string[],
): string {
  const origen = salida.datos.cuenta_id as string;
  const destino = entrada.datos.cuenta_id as string;
  const monto = salida.datos.monto as Centavos;
  const esTarjeta = cuentaPorId(ctx, destino).subtipo === 'tarjeta_credito';
  const mov = esTarjeta
    ? construirPagoTarjeta({ tarjeta: destino, origen, monto })
    : construirTransferencia({ origen, destino, monto });
  const nueva: TransaccionNueva = {
    tipo: mov.tipo,
    fecha: salida.datos.fecha,
    origen: 'notificacion',
    claveIdempotencia: `captura:${salida.id}:${entrada.id}:par`,
    asientos: mov.asientos,
    meta: JSON.stringify({ capturas: [salida.id, entrada.id] }),
  };
  const final = reemplazarVarias(ctx, reemplazar, nueva);
  for (const [yo, otra] of [
    [salida, entrada],
    [entrada, salida],
  ] as const) {
    guardar(ctx, yo.id, {
      estado: 'vinculada',
      datos: { ...yo.datos, pareja: otra.id },
      transaccionId: final,
    });
  }
  trasRegistrar(ctx, final);
  return final;
}

/**
 * Reemplaza la primera de `ids` por `nueva` y anula las demás (E2: nada se borra); las ocurrencias que
 * cubrían vuelven a pendiente (`04 §5`). Sin ids, registra `nueva`.
 */
function reemplazarVarias(ctx: Contexto, ids: readonly string[], nueva: TransaccionNueva): string {
  const [primera, ...resto] = [...new Set(ids)];
  let final: string;
  if (primera === undefined) {
    final = ctx.libro.registrar(nueva).transaccion.id;
  } else {
    final = ctx.libro.reemplazar(primera, nueva).nueva.id;
    liberarOcurrencias(ctx, primera);
  }
  for (const id of resto) {
    ctx.libro.anular(id);
    liberarOcurrencias(ctx, id);
  }
  return final;
}

// ——— Paso 4: registro según el tipo ———

interface Registro {
  readonly mov: MovimientoPropuesto;
  readonly revisar: readonly MotivoRevisar[];
  readonly comercio?: string | null;
  readonly descripcion?: string | null;
  readonly sinCategoria?: boolean;
}

/** `07 §6`: regla del usuario > catálogo semilla (prefijo más largo) > sin categoría. */
function categoriaDeComercio(ctx: Contexto, comercio: string | undefined): string | null {
  return categoriaAprendida(ctx, comercio, null, 'gasto') ?? categorizarComercio(comercio)?.categoria ?? null;
}

function registrarSegunTipo(ctx: Contexto, c: CapturaLeida): string {
  const d = c.datos;
  const monto = d.monto as Centavos;
  const cuentaId = d.cuenta_id as string;
  const fila = cuentaPorId(ctx, cuentaId);
  const esCredito = fila.subtipo === 'tarjeta_credito';
  let r: Registro;
  switch (d.tipo) {
    case 'cargo': {
      const slug = categoriaDeComercio(ctx, d.comercio);
      const revisar: MotivoRevisar[] = [];
      if (slug === null) revisar.push('sin_categoria');
      if (esCredito && monto >= UMBRAL_FUE_A_MESES) revisar.push('fue_a_meses');
      r = {
        mov: construirGasto({ categoria: idCategoria(slug ?? 'otros_gastos'), pago: cuentaId, monto }),
        revisar,
        comercio: d.comercio ?? null,
        sinCategoria: slug === null,
      };
      break;
    }
    case 'retiro': {
      const efectivo = cuentaEfectivo(ctx);
      if (!efectivo) throw new ErrorDominio('sin_efectivo', 'no hay cuenta de efectivo');
      r = {
        mov: construirRetiroEfectivo({ efectivo: efectivo.id, origen: cuentaId, monto }),
        // Disposición de efectivo con crédito: advertencia de comisión e intereses (`02 §5`).
        revisar: esCredito ? ['disposicion'] : [],
      };
      break;
    }
    case 'transferencia_enviada':
      // Caso 15: sale de L de inmediato; el tránsito positivo no es líquido.
      r = {
        mov: construirSalidaPendiente({ origen: cuentaId, transito: CUENTAS_SISTEMA.transito, monto }),
        revisar: [],
      };
      break;
    case 'pago_recibido_tarjeta':
      // Caso 17: el tránsito negativo resta de L hasta ver la salida.
      r = {
        mov: construirPagoRecibidoPendiente({ tarjeta: cuentaId, transito: CUENTAS_SISTEMA.transito, monto }),
        revisar: [],
      };
      break;
    case 'transferencia_recibida':
    case 'cobro_recibido':
      r = registroEntrada(ctx, d, cuentaId, monto);
      break;
    case 'devolucion':
      r = registroDevolucion(ctx, d, cuentaId, monto);
      break;
    default:
      throw new ErrorDominio('captura_invalida', 'tipo de captura sin registro');
  }
  const meta = {
    captura: c.id,
    ...(r.revisar.length > 0 ? { revisar: r.revisar } : {}),
    ...(r.sinCategoria ? { sin_categoria: true } : {}),
  };
  return ctx.libro.registrar({
    tipo: r.mov.tipo,
    fecha: d.fecha,
    origen: 'notificacion',
    claveIdempotencia: `captura:${c.id}`,
    asientos: r.mov.asientos,
    descripcion: r.descripcion ?? null,
    comercio: r.comercio ?? null,
    porRevisar: r.revisar.length > 0,
    meta: JSON.stringify(meta),
  }).transaccion.id;
}

/** Umbral de E9.2 para reconocer a un contacto en la contraparte de una transferencia (`07 §5`). */
export const UMBRAL_CONTACTO = 0.85;

/**
 * `transferencia_recibida` (`07 §5`): (a) un contacto que te debe y el monto no pasa de su deuda →
 * `cobro_prestamo`; (b) cubre una ocurrencia de ingreso → `ingreso` con la categoría del programado; (c)
 * `ingreso` `otros_ingresos` por revisar. `cobro_recibido` (terminal, M11) cae en (c) mientras no hay negocio.
 */
function registroEntrada(ctx: Contexto, d: DatosCaptura, cuentaId: string, monto: Centavos): Registro {
  if (d.tipo === 'transferencia_recibida' && d.contraparte) {
    const contraparte = normalizarComercio(d.contraparte);
    let mejor: { cuentaId: string; s: number; saldo: Centavos } | null = null;
    for (const p of listarPersonas(ctx)) {
      if (p.saldo <= 0) continue;
      const s = similitud(contraparte, normalizarComercio(p.nombre));
      if (s >= UMBRAL_CONTACTO && (mejor === null || s > mejor.s))
        mejor = { cuentaId: p.cuentaId, s, saldo: p.saldo };
    }
    if (mejor && monto <= mejor.saldo) {
      return {
        mov: construirCobroPrestamo({ persona: mejor.cuentaId, destino: cuentaId, monto }),
        revisar: monto === mejor.saldo ? [] : ['cobro'],
        descripcion: d.contraparte,
      };
    }
  }
  const programado = ingresoQueCubriria(ctx, { fecha: d.fecha, monto, cuenta: cuentaId });
  if (programado) {
    return {
      mov: construirIngreso({
        destino: cuentaId,
        categoria: programado.categoriaCuentaId ?? idCategoria('otros_ingresos'),
        monto,
      }),
      revisar: [],
      descripcion: d.contraparte ?? null,
    };
  }
  return {
    mov: construirIngreso({ destino: cuentaId, categoria: idCategoria('otros_ingresos'), monto }),
    revisar: ['ingreso'],
    descripcion: d.contraparte ?? null,
  };
}

/**
 * Devolución (`07 §5`, caso 21): el cargo original es un gasto vigente con el mismo comercio normalizado, monto
 * ≥ la devolución y de los últimos 60 días (el de la misma cuenta y más reciente primero) → `reembolso` contra
 * su categoría; si no lo encuentra, contra `ingreso:reembolso`.
 */
function registroDevolucion(ctx: Contexto, d: DatosCaptura, cuentaId: string, monto: Centavos): Registro {
  const comercio = normalizarComercio(d.comercio);
  let contra = idCategoria('reembolso');
  if (comercio !== '') {
    const gastos = ctx.db
      .select()
      .from(tv)
      .where(
        and(
          inArray(tv.tipo, ['gasto', 'compra_msi']),
          gte(tv.fecha, sumarDias(d.fecha, -DIAS_DEVOLUCION)),
          lte(tv.fecha, d.fecha),
        ),
      )
      .all()
      .filter((t) => normalizarComercio(t.comercio) === comercio);
    let mejor: { categoria: string; mismaCuenta: boolean; fecha: PlainDate } | null = null;
    for (const t of gastos) {
      const asientos = asientosDe(ctx, t.id);
      const categoria = asientos.find((a) => a.c.naturaleza === 'gasto' && a.monto > 0);
      if (!categoria || categoria.monto < monto) continue;
      const mismaCuenta = asientos.some((a) => (a.c.padreId ?? a.cuentaId) === cuentaId);
      const gana =
        mejor === null ||
        (mismaCuenta && !mejor.mismaCuenta) ||
        (mismaCuenta === mejor.mismaCuenta && t.fecha > mejor.fecha);
      if (gana) mejor = { categoria: categoria.cuentaId, mismaCuenta, fecha: t.fecha };
    }
    if (mejor) contra = mejor.categoria;
  }
  return {
    mov: construirReembolso({ destino: cuentaId, contra, monto }),
    revisar: [],
    comercio: d.comercio ?? null,
  };
}

// ——— Auditoría de cambios no financieros ———

/** Quita `por_revisar` de la transacción (editable sin reversa) y deja registro en `auditoria` (`04 §3`). */
export function marcarRevisada(ctx: Contexto, transaccionId: string): void {
  const fila = ctx.db
    .select({ porRevisar: transaccion.porRevisar })
    .from(transaccion)
    .where(eq(transaccion.id, transaccionId))
    .get();
  if (!fila || fila.porRevisar === 0) return;
  ctx.db.update(transaccion).set({ porRevisar: 0 }).where(eq(transaccion.id, transaccionId)).run();
  ctx.db
    .insert(auditoria)
    .values({
      id: ctx.generarId(),
      en: ctx.reloj.ahora(),
      entidad: 'transaccion',
      entidadId: transaccionId,
      accion: 'revisada',
      antes: JSON.stringify({ por_revisar: 1 }),
      despues: JSON.stringify({ por_revisar: 0 }),
    })
    .run();
}

/** Lo que el resto de los servicios necesita para contestar preguntas de captura. */
export const internos = {
  guardar,
  aplicarPar,
  reemplazarVarias,
  asientosDe,
  sentidoDe,
  categoriaDeComercio,
  registroDevolucion,
};
