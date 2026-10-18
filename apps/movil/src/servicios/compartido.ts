import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  construirCobroPrestamo,
  construirGastoPareja,
  construirPagoPrestamo,
  ErrorDominio,
  repartoPareja,
  type Centavos,
  type MovimientoPropuesto,
  type PlainDate,
} from '@cartera/core';
import { claveReversa, CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import {
  cifrarEvento,
  codificarQr,
  CuerpoGasto,
  CuerpoPago,
  descifrarFila,
  EventoCompartido,
  idsAnulados,
  leerQr,
  MAX_DESCRIPCION,
  nuevaLlaveGrupo,
  saldoGrupo,
  uuid4,
  type Autor,
  type CriptoSincronizacion,
} from '@cartera/sincronizacion';
import type { AlmacenSeguro } from '../db/llave';
import { borrarLlaveGrupo, guardarLlaveGrupo, obtenerLlaveGrupo } from '../compartido/llaves';
import type { ClienteCompartido, ErrorCompartido } from '../nube/compartido-nube';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { idCategoriaDe, insertarCuenta, normalizarAliases } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { etiquetaFecha, pesos } from './formato';
import { leerAjuste, escribirAjuste } from './preferencias';

/**
 * Gastos compartidos en pareja (M16, `02 §27`, `05 §E12.2` y `§E17`). Cada teléfono guarda los eventos del grupo
 * ya descifrados en `evento_compartido` y lleva a **su** libro los asientos de E12.2 (caso 31 de `04 §4`); al
 * servidor solo suben blobs cifrados con la llave del grupo, que vive en el almacén seguro (`compartido/llaves`).
 * Agregar, saldar y anular funcionan sin conexión: el evento queda pendiente (`recibido_en` nulo) hasta la
 * siguiente sincronización. Nada de esto registra montos, nombres ni descripciones (regla 9).
 */

const { grupoCompartido, eventoCompartido, contacto, aliasContacto, transaccion } = esquema;

/** Lo que necesita la parte en red: criptografía, almacén seguro y cliente de `/compartido/*` (`null` sin nube). */
export interface DependenciasCompartido {
  readonly cripto: CriptoSincronizacion;
  readonly almacen: AlmacenSeguro;
  readonly cliente: ClienteCompartido | null;
}

export type ErrorAccionCompartido =
  | ErrorCompartido
  /** La app no tiene configurado el servicio en la nube. */
  | 'sin_servicio'
  /** El código escaneado no es un QR de Finanvoz. */
  | 'qr_invalido'
  /** Falta la llave del grupo en este teléfono: hay que volver a vincular. */
  | 'sin_llave'
  /** Un evento del servidor no se pudo descifrar (llave equivocada o blob alterado). */
  | 'evento_ilegible'
  /** El QR es de un grupo que ya existe aquí con otro lugar. */
  | 'otro_lugar';

export type ResultadoAccion<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorAccionCompartido };

const falla = (error: ErrorAccionCompartido) => ({ ok: false as const, error });

/** Estado de sincronización por grupo (tabla `ajuste`, clave `compartido:<grupo_id>`). */
const EstadoGrupo = z.strictObject({
  /** `cursor` de la última página descargada (`03 §6`). */
  cursor: z.string().nullable(),
  /** El servidor ya no reconoce esta sesión o falta la llave: ofrecer "Volver a vincular". */
  revincular: z.boolean(),
  /** Quién cerró el grupo, para el aviso (`02 §27`). */
  cerrado_por: z.enum(['yo', 'otro']).nullable(),
});
type EstadoGrupo = z.infer<typeof EstadoGrupo>;

const claveEstado = (grupoId: string) => `compartido:${grupoId}`;
const ESTADO_INICIAL: EstadoGrupo = { cursor: null, revincular: false, cerrado_por: null };

function leerEstado(ctx: Contexto, grupoId: string): EstadoGrupo {
  return leerAjuste(ctx, claveEstado(grupoId), EstadoGrupo) ?? ESTADO_INICIAL;
}

function cambiarEstado(ctx: Contexto, grupoId: string, cambios: Partial<EstadoGrupo>): void {
  escribirAjuste(ctx, claveEstado(grupoId), EstadoGrupo, { ...leerEstado(ctx, grupoId), ...cambios });
}

/** Eventos por publicación (el tope del servidor). */
const LOTE_PUBLICAR = 50;
/** Tope de páginas por sincronización (200 eventos cada una): evita un ciclo sin fin si el servidor falla. */
const MAX_PAGINAS = 100;

type FilaGrupo = typeof grupoCompartido.$inferSelect;
type FilaEvento = typeof eventoCompartido.$inferSelect;

function grupoPorId(ctx: Contexto, grupoId: string): FilaGrupo {
  const g = ctx.db.select().from(grupoCompartido).where(eq(grupoCompartido.id, grupoId)).get();
  if (!g) throw new ErrorDominio('grupo_inexistente', 'el grupo compartido no existe');
  return g;
}

function exigirAbierto(g: FilaGrupo): void {
  if (g.cerradoEn !== null) throw new ErrorDominio('grupo_cerrado', 'el grupo compartido ya está cerrado');
}

function eventosDe(ctx: Contexto, grupoId: string): FilaEvento[] {
  return ctx.db
    .select()
    .from(eventoCompartido)
    .where(eq(eventoCompartido.grupoId, grupoId))
    .orderBy(asc(eventoCompartido.creadoEn), asc(eventoCompartido.id))
    .all();
}

function aEvento(f: FilaEvento): EventoCompartido {
  return EventoCompartido.parse({
    id: f.id,
    grupo_id: f.grupoId,
    autor: f.autor,
    creado_en: f.creadoEn,
    tipo: f.tipo,
    cuerpo: JSON.parse(f.cuerpo) as unknown,
  });
}

function validarNombre(nombre: string): string {
  const n = nombre.trim();
  if (n === '' || n.length > 80) throw new ErrorDominio('persona_invalida', 'falta el nombre');
  return n;
}

/** Contacto y cuenta `contraparte:pareja` del grupo (`04 §2`); "apartar lo que le debo" encendido. */
function crearPareja(ctx: Contexto, nombre: string): string {
  const contactoId = ctx.generarId();
  ctx.db.insert(contacto).values({ id: contactoId, nombre, creadoEn: ctx.reloj.ahora() }).run();
  const alias = normalizarAliases([nombre]);
  if (alias.length > 0) {
    ctx.db
      .insert(aliasContacto)
      .values(alias.map((a) => ({ contactoId, aliasNormalizado: a })))
      .run();
  }
  return insertarCuenta(ctx, { naturaleza: 'contraparte', subtipo: 'pareja', nombre, contactoId });
}

function crearGrupoLocal(ctx: Contexto, grupoId: string, nombre: string, miAutor: Autor): void {
  enTransaccion(ctx, () => {
    const contraparteId = crearPareja(ctx, nombre);
    ctx.db
      .insert(grupoCompartido)
      .values({ id: grupoId, nombre, contraparteId, miAutor, creadoEn: ctx.reloj.ahora(), cerradoEn: null })
      .run();
    escribirAjuste(ctx, claveEstado(grupoId), EstadoGrupo, ESTADO_INICIAL);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Libro de cada quien (E12.2, caso 31)

/**
 * Ids a los que apunta algún `evento_anulado` de este teléfono (compartido o no). Se arma una vez por lote: con
 * miles de eventos, releer el grupo por cada uno era cuadrático.
 */
function idsAnuladosLocales(ctx: Contexto, grupoId: string): Set<string> {
  const filas = ctx.db
    .select({ cuerpo: eventoCompartido.cuerpo })
    .from(eventoCompartido)
    .where(and(eq(eventoCompartido.grupoId, grupoId), eq(eventoCompartido.tipo, 'evento_anulado')))
    .all();
  const ids = new Set<string>();
  for (const f of filas) {
    const id = (JSON.parse(f.cuerpo) as { id_anulado?: unknown }).id_anulado;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

function categoriaLocal(ctx: Contexto, slug: string): string {
  try {
    return idCategoriaDe(ctx, slug, 'gasto');
  } catch {
    // La otra persona usó una categoría que este teléfono no tiene (personalizada o de otra versión).
    return idCategoriaDe(ctx, 'otros_gastos', 'gasto');
  }
}

function idReversa(ctx: Contexto, transaccionId: string): string | null {
  const fila = ctx.db
    .select({ id: transaccion.id })
    .from(transaccion)
    .where(eq(transaccion.claveIdempotencia, claveReversa(transaccionId)))
    .get();
  return fila?.id ?? null;
}

function anularSiHace(ctx: Contexto, transaccionId: string): string | null {
  try {
    return ctx.libro.anular(transaccionId).id;
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === 'ya_anulada') return idReversa(ctx, transaccionId);
    throw e;
  }
}

/**
 * Lleva un evento al libro de este teléfono (idempotente por `compartido:<id>`) y guarda la transacción en
 * `evento_compartido.transaccion_id`. `cuentaLocal` es con qué pagaste o a dónde te llegó el dinero; sin ella
 * (eventos propios recuperados del servidor) se usan las cuentas puente "por asignar". `anulados` sale de
 * `idsAnuladosLocales` con todos los eventos del lote ya guardados.
 */
function aplicarEvento(
  ctx: Contexto,
  g: FilaGrupo,
  e: EventoCompartido,
  anulados: ReadonlySet<string>,
  cuentaLocal?: string,
): void {
  let propuesto: MovimientoPropuesto | null = null;
  let fecha: PlainDate;
  let descripcion: string | null = null;
  switch (e.tipo) {
    case 'gasto_compartido_creado': {
      if (anulados.has(e.id)) return;
      const c = e.cuerpo;
      const r = repartoPareja(c.total, c.proporcion_a_bp);
      const [mia, suya] = g.miAutor === 'a' ? [r.parteA, r.parteB] : [r.parteB, r.parteA];
      propuesto = construirGastoPareja({
        categoria: categoriaLocal(ctx, c.categoria),
        pareja: g.contraparteId,
        parteMia: mia,
        partePareja: suya,
        ...(c.pago === g.miAutor ? { pago: cuentaLocal ?? CUENTAS_SISTEMA.porAsignar } : {}),
      });
      fecha = c.fecha;
      descripcion = c.descripcion === '' ? null : c.descripcion;
      break;
    }
    case 'pago_compartido_creado': {
      if (anulados.has(e.id)) return;
      const c = e.cuerpo;
      propuesto =
        c.de === g.miAutor
          ? construirPagoPrestamo({
              persona: g.contraparteId,
              origen: cuentaLocal ?? CUENTAS_SISTEMA.porAsignar,
              monto: c.monto,
            })
          : construirCobroPrestamo({
              persona: g.contraparteId,
              destino: cuentaLocal ?? CUENTAS_SISTEMA.porAsignarEntradas,
              monto: c.monto,
            });
      fecha = c.fecha;
      break;
    }
    case 'evento_anulado': {
      const objetivo = ctx.db
        .select()
        .from(eventoCompartido)
        .where(and(eq(eventoCompartido.id, e.cuerpo.id_anulado), eq(eventoCompartido.grupoId, g.id)))
        .get();
      if (!objetivo?.transaccionId) return;
      const reversa = anularSiHace(ctx, objetivo.transaccionId);
      ctx.db
        .update(eventoCompartido)
        .set({ transaccionId: reversa })
        .where(eq(eventoCompartido.id, e.id))
        .run();
      return;
    }
  }
  if (propuesto === null) return;
  const { transaccion: tx } = ctx.libro.registrar({
    tipo: propuesto.tipo,
    fecha,
    origen: cuentaLocal ? 'manual' : 'sistema',
    claveIdempotencia: `compartido:${e.id}`,
    asientos: propuesto.asientos,
    descripcion,
    comercio: null,
    porRevisar: false,
  });
  ctx.db.update(eventoCompartido).set({ transaccionId: tx.id }).where(eq(eventoCompartido.id, e.id)).run();
}

function insertarEvento(ctx: Contexto, e: EventoCompartido, recibidoEn: string | null): void {
  ctx.db
    .insert(eventoCompartido)
    .values({
      id: e.id,
      grupoId: e.grupo_id,
      autor: e.autor,
      creadoEn: e.creado_en,
      tipo: e.tipo,
      cuerpo: JSON.stringify(e.cuerpo),
      transaccionId: null,
      recibidoEn,
    })
    .run();
}

/** Crea un evento propio (pendiente de publicar) y lo lleva al libro, en una transacción. */
function crearEventoPropio(
  ctx: Contexto,
  deps: Pick<DependenciasCompartido, 'cripto'>,
  g: FilaGrupo,
  contenido: Pick<EventoCompartido, 'tipo' | 'cuerpo'>,
  cuentaLocal?: string,
): string {
  const evento = EventoCompartido.parse({
    id: uuid4((n) => deps.cripto.aleatorio(n)),
    grupo_id: g.id,
    autor: g.miAutor,
    creado_en: ctx.reloj.ahora(),
    ...contenido,
  });
  enTransaccion(ctx, () => {
    insertarEvento(ctx, evento, null);
    aplicarEvento(ctx, g, evento, idsAnuladosLocales(ctx, g.id), cuentaLocal);
  });
  return evento.id;
}

// ---------------------------------------------------------------------------------------------------------------
// Crear, mostrar el código y unirse (QR)

/**
 * "Crear con alguien": el servidor crea el grupo (quedas como `'a'`) y emite el código de unión; la llave nueva
 * se genera aquí y va solo en el QR. `nombre` es cómo llamas a tu pareja (solo en este teléfono).
 */
export async function crearGrupoCompartido(
  ctx: Contexto,
  deps: DependenciasCompartido,
  nombre: string,
): Promise<ResultadoAccion<{ grupoId: string; qr: string }>> {
  exigirConsentimiento(ctx);
  const n = validarNombre(nombre);
  if (!deps.cliente) return falla('sin_servicio');
  const r = await deps.cliente.crearGrupo();
  if (!r.ok) return r;
  const llave = nuevaLlaveGrupo((k) => deps.cripto.aleatorio(k));
  guardarLlaveGrupo(deps.almacen, r.grupoId, llave);
  crearGrupoLocal(ctx, r.grupoId, n, 'a');
  return {
    ok: true,
    grupoId: r.grupoId,
    qr: codificarQr({ grupoId: r.grupoId, codigoUnion: r.codigoUnion, llave }),
  };
}

/** "Mostrar código" (volver a vincular a tu pareja): código nuevo para su lugar y el QR con la misma llave. */
export async function mostrarCodigo(
  ctx: Contexto,
  deps: DependenciasCompartido,
  grupoId: string,
): Promise<ResultadoAccion<{ qr: string }>> {
  const g = grupoPorId(ctx, grupoId);
  if (g.cerradoEn !== null) return falla('grupo_cerrado');
  const llave = obtenerLlaveGrupo(deps.almacen, grupoId);
  if (!llave) return falla('sin_llave');
  if (!deps.cliente) return falla('sin_servicio');
  const r = await deps.cliente.pedirCodigo(grupoId);
  if (!r.ok) return r;
  return { ok: true, qr: codificarQr({ grupoId, codigoUnion: r.codigoUnion, llave }) };
}

/**
 * Escanear el QR de la otra persona. Si el grupo es nuevo aquí, crea la pareja con `nombre`; si ya existe (se
 * restauró de un respaldo), es "Volver a vincular": esta sesión ocupa tu lugar y la anterior pierde el acceso.
 */
export async function unirseConQr(
  ctx: Contexto,
  deps: DependenciasCompartido,
  texto: string,
  nombre?: string,
): Promise<ResultadoAccion<{ grupoId: string; nuevo: boolean }>> {
  exigirConsentimiento(ctx);
  const datos = leerQr(texto);
  if (!datos) return falla('qr_invalido');
  const local =
    ctx.db.select().from(grupoCompartido).where(eq(grupoCompartido.id, datos.grupoId)).get() ?? null;
  if (local?.cerradoEn != null) return falla('grupo_cerrado');
  const n = local ? local.nombre : validarNombre(nombre ?? '');
  if (!deps.cliente) return falla('sin_servicio');
  const r = await deps.cliente.unirse(datos.grupoId, datos.codigoUnion);
  if (!r.ok) return r;
  if (local && local.miAutor !== r.autor) return falla('otro_lugar');
  guardarLlaveGrupo(deps.almacen, datos.grupoId, datos.llave);
  if (local) cambiarEstado(ctx, datos.grupoId, { revincular: false });
  else crearGrupoLocal(ctx, datos.grupoId, n, r.autor);
  await sincronizarGrupo(ctx, deps, datos.grupoId);
  return { ok: true, grupoId: datos.grupoId, nuevo: !local };
}

// ---------------------------------------------------------------------------------------------------------------
// Agregar, saldar y anular (sin conexión)

export const EntradaGastoCompartido = z.strictObject({
  total: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  pagueYo: z.boolean(),
  /** Tu parte en puntos base: 5000 = 50/50; 6000 = pones 60 %. */
  miParteBp: z.int().min(0).max(10000),
  descripcion: z.string().trim().max(MAX_DESCRIPCION),
  categoria: z.string().min(1),
  /** Con qué pagaste (solo si pagaste tú); sin ella, "por asignar". */
  cuentaId: z.string().min(1).optional(),
  fecha: z.string().optional(),
});
export type EntradaGastoCompartido = z.infer<typeof EntradaGastoCompartido>;

/** Agrega un gasto compartido ("Súper 1,200, pagué yo, 60/40"). Queda pendiente de compartir. */
export function agregarGastoCompartido(
  ctx: Contexto,
  deps: Pick<DependenciasCompartido, 'cripto'>,
  grupoId: string,
  entrada: EntradaGastoCompartido,
): { eventoId: string } {
  exigirConsentimiento(ctx);
  const r = EntradaGastoCompartido.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('movimiento_invalido', 'revisa los datos del gasto compartido');
  const e = r.data;
  const g = grupoPorId(ctx, grupoId);
  exigirAbierto(g);
  idCategoriaDe(ctx, e.categoria, 'gasto');
  const cuerpo = CuerpoGasto.safeParse({
    fecha: e.fecha ?? ctx.reloj.hoy(),
    total: e.total,
    pago: e.pagueYo ? g.miAutor : g.miAutor === 'a' ? 'b' : 'a',
    proporcion_a_bp: g.miAutor === 'a' ? e.miParteBp : 10000 - e.miParteBp,
    descripcion: e.descripcion,
    categoria: e.categoria,
  });
  if (!cuerpo.success) throw new ErrorDominio('movimiento_invalido', 'revisa los datos del gasto compartido');
  const eventoId = crearEventoPropio(
    ctx,
    deps,
    g,
    { tipo: 'gasto_compartido_creado', cuerpo: cuerpo.data },
    e.pagueYo ? e.cuentaId : undefined,
  );
  return { eventoId };
}

/**
 * "Saldar" (E12-21): un pago entre ustedes. `quien` = `'yo'` si le pagas a tu pareja (sale de `cuentaId`) u
 * `'otro'` si te pagó (llega a `cuentaId`).
 */
export function registrarPagoCompartido(
  ctx: Contexto,
  deps: Pick<DependenciasCompartido, 'cripto'>,
  grupoId: string,
  entrada: { monto: Centavos; quien: 'yo' | 'otro'; cuentaId?: string; fecha?: string },
): { eventoId: string } {
  exigirConsentimiento(ctx);
  const g = grupoPorId(ctx, grupoId);
  exigirAbierto(g);
  const cuerpo = CuerpoPago.safeParse({
    fecha: entrada.fecha ?? ctx.reloj.hoy(),
    de: entrada.quien === 'yo' ? g.miAutor : g.miAutor === 'a' ? 'b' : 'a',
    monto: entrada.monto,
  });
  if (!cuerpo.success) throw new ErrorDominio('monto_invalido', 'revisa el monto');
  const eventoId = crearEventoPropio(
    ctx,
    deps,
    g,
    { tipo: 'pago_compartido_creado', cuerpo: cuerpo.data },
    entrada.cuentaId,
  );
  return { eventoId };
}

/**
 * Anula un gasto o pago que registraste tú (corregir = anular + crear de nuevo). Lo de tu pareja solo lo anula
 * ella: así nadie borra por su cuenta lo que le debe al otro.
 */
export function anularEventoCompartido(
  ctx: Contexto,
  deps: Pick<DependenciasCompartido, 'cripto'>,
  grupoId: string,
  eventoId: string,
): { eventoId: string } {
  exigirConsentimiento(ctx);
  const g = grupoPorId(ctx, grupoId);
  exigirAbierto(g);
  const objetivo = eventosDe(ctx, grupoId).find((f) => f.id === eventoId);
  if (!objetivo || objetivo.tipo === 'evento_anulado')
    throw new ErrorDominio('evento_inexistente', 'no existe ese movimiento compartido');
  if (objetivo.autor !== g.miAutor)
    throw new ErrorDominio('evento_ajeno', 'solo puedes anular lo que registraste tú');
  if (idsAnuladosLocales(ctx, grupoId).has(eventoId))
    throw new ErrorDominio('ya_anulada', 'ese movimiento ya está anulado');
  return {
    eventoId: crearEventoPropio(ctx, deps, g, { tipo: 'evento_anulado', cuerpo: { id_anulado: eventoId } }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Sincronizar y salir

type ResultadoPublicar = { ok: true; cerrado: boolean } | { ok: false; error: ErrorAccionCompartido };

async function publicarPendientes(
  ctx: Contexto,
  deps: DependenciasCompartido & { cliente: ClienteCompartido },
  g: FilaGrupo,
  llave: Uint8Array,
): Promise<ResultadoPublicar> {
  const pendientes = ctx.db
    .select()
    .from(eventoCompartido)
    .where(and(eq(eventoCompartido.grupoId, g.id), isNull(eventoCompartido.recibidoEn)))
    .orderBy(asc(eventoCompartido.creadoEn), asc(eventoCompartido.id))
    .all();
  for (let i = 0; i < pendientes.length; i += LOTE_PUBLICAR) {
    const lote = pendientes.slice(i, i + LOTE_PUBLICAR);
    const filas = [];
    for (const f of lote) filas.push(await cifrarEvento(deps.cripto, llave, aEvento(f)));
    const r = await deps.cliente.publicar(
      g.id,
      filas.map((f) => ({ id: f.id, blob: f.blob })),
    );
    if (!r.ok) {
      if (r.error === 'grupo_cerrado') return { ok: true, cerrado: true };
      if (r.error === 'no_miembro') cambiarEstado(ctx, g.id, { revincular: true });
      return r;
    }
    enTransaccion(ctx, () => {
      for (const x of r.recibidos) {
        ctx.db
          .update(eventoCompartido)
          .set({ recibidoEn: x.recibidoEn })
          .where(and(eq(eventoCompartido.id, x.id), eq(eventoCompartido.grupoId, g.id)))
          .run();
      }
    });
  }
  return { ok: true, cerrado: false };
}

/** Guarda lo descargado: eventos nuevos (que se llevan al libro) y la confirmación de los propios. */
function incorporar(
  ctx: Contexto,
  g: FilaGrupo,
  eventos: readonly { evento: EventoCompartido; recibidoEn: string }[],
) {
  const nuevos: EventoCompartido[] = [];
  for (const { evento, recibidoEn } of eventos) {
    const existe = ctx.db.select().from(eventoCompartido).where(eq(eventoCompartido.id, evento.id)).get();
    if (existe) {
      if (existe.grupoId === g.id && existe.recibidoEn === null) {
        ctx.db.update(eventoCompartido).set({ recibidoEn }).where(eq(eventoCompartido.id, evento.id)).run();
      }
      continue;
    }
    insertarEvento(ctx, evento, recibidoEn);
    nuevos.push(evento);
  }
  // Primero se guardan todos y luego se aplican: una anulación que llega junto con su gasto lo deja fuera.
  if (nuevos.length === 0) return;
  const anulados = idsAnuladosLocales(ctx, g.id);
  for (const e of nuevos) aplicarEvento(ctx, g, e, anulados);
}

/**
 * Cierre local (E17 pasos 3 a 5): guarda `cerrado_en`, anula en tu libro lo que creaste y ya no se pudo
 * compartir ("No se compartió: el grupo ya estaba cerrado") y devuelve a tu libro lo que habías anulado sin
 * llegar a compartir la anulación. Así el libro queda igual al saldo de los eventos compartidos.
 */
function cerrarLocal(ctx: Contexto, g: FilaGrupo, cerradoEn: string, por: 'yo' | 'otro'): void {
  enTransaccion(ctx, () => {
    const ms = Date.parse(cerradoEn);
    ctx.db
      .update(grupoCompartido)
      .set({ cerradoEn: Number.isFinite(ms) ? ms : ctx.reloj.ahora() })
      .where(eq(grupoCompartido.id, g.id))
      .run();
    const todos = eventosDe(ctx, g.id);
    const porId = new Map(todos.map((f) => [f.id, f]));
    for (const f of todos) {
      if (f.recibidoEn !== null) continue;
      if (f.tipo !== 'evento_anulado') {
        if (f.transaccionId) anularSiHace(ctx, f.transaccionId);
        continue;
      }
      const idAnulado = (JSON.parse(f.cuerpo) as { id_anulado: string }).id_anulado;
      const objetivo = porId.get(idAnulado);
      if (!objetivo || objetivo.recibidoEn === null || !objetivo.transaccionId) continue;
      const original = ctx.libro.obtener(objetivo.transaccionId);
      if (!original || !idReversa(ctx, original.id)) continue;
      const { transaccion: tx } = ctx.libro.registrar({
        tipo: original.tipo,
        fecha: original.fecha,
        origen: 'sistema',
        claveIdempotencia: `compartido:${objetivo.id}:restablecido`,
        asientos: original.asientos.map((a) => ({ cuentaId: a.cuentaId, monto: a.monto })),
        descripcion: null,
        comercio: null,
        porRevisar: false,
      });
      ctx.db
        .update(eventoCompartido)
        .set({ transaccionId: tx.id })
        .where(eq(eventoCompartido.id, objetivo.id))
        .run();
    }
    cambiarEstado(ctx, g.id, { cerrado_por: leerEstado(ctx, g.id).cerrado_por ?? por, revincular: false });
  });
}

/**
 * Publica lo pendiente y descarga lo nuevo (`03 §6`). Si el grupo se cerró, termina de descargar, cierra aquí y
 * borra la llave. Un evento ilegible detiene la descarga sin avanzar el cursor (no se pierde nada).
 */
export async function sincronizarGrupo(
  ctx: Contexto,
  deps: DependenciasCompartido,
  grupoId: string,
): Promise<ResultadoAccion> {
  const g = grupoPorId(ctx, grupoId);
  const llave = obtenerLlaveGrupo(deps.almacen, grupoId);
  if (g.cerradoEn !== null) {
    // Ya cerrado aquí: solo queda borrar la llave si un cierre anterior no alcanzó a hacerlo.
    if (llave) await borrarLlaveGrupo(deps.almacen, grupoId);
    return { ok: true };
  }
  if (!llave) {
    cambiarEstado(ctx, grupoId, { revincular: true });
    return falla('sin_llave');
  }
  if (!deps.cliente) return falla('sin_servicio');
  const conCliente = { ...deps, cliente: deps.cliente };

  const pub = await publicarPendientes(ctx, conCliente, g, llave);
  if (!pub.ok) return pub;

  let cursor = leerEstado(ctx, grupoId).cursor;
  let cerradoEn: string | null = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const r = await deps.cliente.descargar(grupoId, cursor);
    if (!r.ok) {
      if (r.error === 'no_miembro') cambiarEstado(ctx, grupoId, { revincular: true });
      return r;
    }
    const descifrados: { evento: EventoCompartido; recibidoEn: string }[] = [];
    try {
      for (const fila of r.eventos) {
        const evento = await descifrarFila(deps.cripto, llave, {
          grupo_id: grupoId,
          id: fila.id,
          autor: fila.autor,
          blob: fila.blob,
        });
        descifrados.push({ evento, recibidoEn: fila.recibidoEn });
      }
    } catch {
      return falla('evento_ilegible');
    }
    const siguiente = r.cursor ?? cursor;
    enTransaccion(ctx, () => {
      incorporar(ctx, g, descifrados);
      cambiarEstado(ctx, grupoId, { cursor: siguiente, revincular: false });
    });
    cursor = siguiente;
    cerradoEn = r.cerradoEn;
    if (!r.mas) break;
    if (pagina === MAX_PAGINAS - 1) return falla('servidor');
  }
  if (cerradoEn !== null) {
    cerrarLocal(ctx, g, cerradoEn, 'otro');
    await borrarLlaveGrupo(deps.almacen, grupoId);
  }
  return { ok: true };
}

export interface ResultadoSincronizarTodos {
  /** Grupos abiertos al empezar. */
  readonly grupos: number;
  /** Los que no se pudieron sincronizar, con su motivo (en el orden de `gruposAbiertos`). */
  readonly errores: readonly ErrorAccionCompartido[];
}

/**
 * Sincroniza uno tras otro los grupos abiertos (al abrir Gastos compartidos, al volver la red y en la tarea en
 * segundo plano). Cada grupo decide como `sincronizarGrupo`: un evento ilegible no avanza el cursor y
 * `no_miembro` marca "Volver a vincular". Un grupo que falla no detiene a los demás.
 */
export async function sincronizarGruposAbiertos(
  ctx: Contexto,
  deps: DependenciasCompartido,
): Promise<ResultadoSincronizarTodos> {
  const ids = gruposAbiertos(ctx);
  const errores: ErrorAccionCompartido[] = [];
  for (const id of ids) {
    try {
      const r = await sincronizarGrupo(ctx, deps, id);
      if (!r.ok) errores.push(r.error);
    } catch {
      errores.push('servidor');
    }
  }
  return { grupos: ids.length, errores };
}

/**
 * "Dejar de compartir" (E17, salir): publica lo pendiente, cierra el grupo para los dos en el servidor, descarga
 * todo lo publicado hasta el cierre y solo entonces borra la llave.
 */
export async function salirDelGrupo(
  ctx: Contexto,
  deps: DependenciasCompartido,
  grupoId: string,
): Promise<ResultadoAccion> {
  const g = grupoPorId(ctx, grupoId);
  if (g.cerradoEn !== null) return { ok: true };
  const llave = obtenerLlaveGrupo(deps.almacen, grupoId);
  if (!llave) return falla('sin_llave');
  if (!deps.cliente) return falla('sin_servicio');
  const pub = await publicarPendientes(ctx, { ...deps, cliente: deps.cliente }, g, llave);
  if (!pub.ok) return pub;
  const r = await deps.cliente.salir(grupoId);
  if (!r.ok) return r;
  if (leerEstado(ctx, grupoId).cerrado_por === null && !pub.cerrado) {
    cambiarEstado(ctx, grupoId, { cerrado_por: 'yo' });
  }
  return sincronizarGrupo(ctx, deps, grupoId);
}

// ---------------------------------------------------------------------------------------------------------------
// Vistas (`02 §27`)

export interface SaldoCompartido {
  /** Desde tu lado: > 0 te debe, < 0 le debes. */
  readonly saldo: Centavos;
  readonly monto: Centavos;
  /** Quién debe: `'yo'`, `'otro'` o nadie. */
  readonly debe: 'yo' | 'otro' | null;
  /** "Ana te debe $X" · "Le debes $1,600.01 a Ana" · "Están a mano". */
  readonly texto: string;
}

export interface MovimientoCompartido {
  readonly id: string;
  readonly tipo: 'gasto' | 'pago';
  readonly fecha: PlainDate;
  readonly fechaTexto: string;
  readonly titulo: string;
  /** "Pagaste $1,200.00 · tu parte $720.00" o "Ana te pagó $1,000.00". */
  readonly detalle: string;
  readonly propio: boolean;
  readonly anulado: boolean;
  /** Aún no llega al servidor. */
  readonly pendiente: boolean;
  /** El grupo se cerró antes de compartirlo: se anuló en tu libro. */
  readonly noCompartido: boolean;
  /** Se puede anular desde aquí (tuyo, vigente y con el grupo abierto). */
  readonly anulable: boolean;
}

export interface GrupoCompartidoVista {
  readonly id: string;
  readonly nombre: string;
  readonly abierto: boolean;
  readonly saldo: SaldoCompartido;
  /** "Ana cerró el grupo compartido" o "Cerraste el grupo compartido". */
  readonly avisoCierre: string | null;
  /** Ofrecer "Volver a vincular" (falta la llave o el servidor ya no reconoce esta sesión). */
  readonly revincular: boolean;
  readonly pendientes: number;
}

export const AVISO_NO_COMPARTIDO = 'No se compartió: el grupo ya estaba cerrado';

/** Texto del saldo desde tu lado (E12.2: `saldo > 0` → B le debe a A). */
export function textoSaldo(nombre: string, saldoMio: Centavos): SaldoCompartido {
  const monto = Math.abs(saldoMio);
  if (saldoMio > 0)
    return { saldo: saldoMio, monto, debe: 'otro', texto: `${nombre} te debe ${pesos(monto)}` };
  if (saldoMio < 0)
    return { saldo: saldoMio, monto, debe: 'yo', texto: `Le debes ${pesos(monto)} a ${nombre}` };
  return { saldo: 0, monto: 0, debe: null, texto: 'Están a mano' };
}

/** Eventos que cuentan para el saldo: todos mientras está abierto; ya cerrado, solo los compartidos. */
function eventosQueCuentan(g: FilaGrupo, filas: readonly FilaEvento[]): EventoCompartido[] {
  return filas.filter((f) => g.cerradoEn === null || f.recibidoEn !== null).map(aEvento);
}

function vistaGrupo(ctx: Contexto, almacen: AlmacenSeguro, g: FilaGrupo): GrupoCompartidoVista {
  const filas = eventosDe(ctx, g.id);
  const b = saldoGrupo(eventosQueCuentan(g, filas));
  const estado = leerEstado(ctx, g.id);
  const abierto = g.cerradoEn === null;
  let sinLlave = false;
  if (abierto) {
    try {
      sinLlave = obtenerLlaveGrupo(almacen, g.id) === null;
    } catch {
      sinLlave = true;
    }
  }
  return {
    id: g.id,
    nombre: g.nombre,
    abierto,
    saldo: textoSaldo(g.nombre, g.miAutor === 'a' ? b.saldo : -b.saldo),
    avisoCierre: abierto
      ? null
      : estado.cerrado_por === 'yo'
        ? 'Cerraste el grupo compartido'
        : `${g.nombre} cerró el grupo compartido`,
    revincular: abierto && (estado.revincular || sinLlave),
    pendientes: abierto ? filas.filter((f) => f.recibidoEn === null).length : 0,
  };
}

export function listarGruposCompartidos(ctx: Contexto, almacen: AlmacenSeguro): GrupoCompartidoVista[] {
  return ctx.db
    .select()
    .from(grupoCompartido)
    .orderBy(asc(grupoCompartido.creadoEn), asc(grupoCompartido.id))
    .all()
    .map((g) => vistaGrupo(ctx, almacen, g))
    .sort((x, y) => Number(y.abierto) - Number(x.abierto));
}

export function obtenerGrupoCompartido(
  ctx: Contexto,
  almacen: AlmacenSeguro,
  grupoId: string,
): GrupoCompartidoVista & { readonly movimientos: readonly MovimientoCompartido[] } {
  const g = grupoPorId(ctx, grupoId);
  const filas = eventosDe(ctx, grupoId);
  const abierto = g.cerradoEn === null;
  const anulados = idsAnulados(eventosQueCuentan(g, filas));
  const anuladosLocal = idsAnulados(filas.map(aEvento));
  const movimientos: MovimientoCompartido[] = [];
  for (const f of [...filas].reverse()) {
    const e = aEvento(f);
    if (e.tipo === 'evento_anulado') continue;
    const propio = e.autor === g.miAutor;
    const noCompartido = !abierto && f.recibidoEn === null;
    const anulado = anulados.has(e.id) || noCompartido;
    const base = {
      id: e.id,
      fecha: e.cuerpo.fecha,
      fechaTexto: etiquetaFecha(e.cuerpo.fecha),
      propio,
      anulado,
      pendiente: abierto && f.recibidoEn === null,
      noCompartido,
      anulable: abierto && propio && !anuladosLocal.has(e.id),
    };
    if (e.tipo === 'gasto_compartido_creado') {
      const c = e.cuerpo;
      const r = repartoPareja(c.total, c.proporcion_a_bp);
      const mia = g.miAutor === 'a' ? r.parteA : r.parteB;
      const quien = c.pago === g.miAutor ? 'Pagaste' : `Pagó ${g.nombre}`;
      movimientos.push({
        ...base,
        tipo: 'gasto',
        titulo: c.descripcion === '' ? 'Gasto compartido' : c.descripcion,
        detalle: `${quien} ${pesos(c.total)} · tu parte ${pesos(mia)}`,
      });
    } else {
      const c = e.cuerpo;
      movimientos.push({
        ...base,
        tipo: 'pago',
        titulo: 'Pago para saldar',
        detalle:
          c.de === g.miAutor
            ? `Le pagaste ${pesos(c.monto)} a ${g.nombre}`
            : `${g.nombre} te pagó ${pesos(c.monto)}`,
      });
    }
  }
  return { ...vistaGrupo(ctx, almacen, g), movimientos };
}

/** Grupos abiertos (para sincronizar al abrir la pantalla). */
export function gruposAbiertos(ctx: Contexto): string[] {
  return gruposAbiertosConNombre(ctx).map((g) => g.id);
}

/** Grupos abiertos con el nombre de la pareja (para elegir a quién va un gasto dictado). */
export function gruposAbiertosConNombre(ctx: Contexto): { id: string; nombre: string }[] {
  return ctx.db
    .select({ id: grupoCompartido.id, nombre: grupoCompartido.nombre })
    .from(grupoCompartido)
    .where(isNull(grupoCompartido.cerradoEn))
    .orderBy(asc(grupoCompartido.creadoEn), asc(grupoCompartido.id))
    .all();
}

/** Solo para pruebas (rendimiento de la descarga, pendiente 149). */
export const internos = { incorporar, idsAnuladosLocales };
