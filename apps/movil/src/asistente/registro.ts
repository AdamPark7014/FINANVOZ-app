import { sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import type { TipoReparacion } from '@cartera/nlu';
import {
  aplicarCorreccion,
  AVISO_DEDUCIBLE_EFECTIVO,
  confirmarAjuste,
  detalleRegistro,
  confirmarRegistro,
  etiquetaDiaMes,
  etiquetaFecha,
  listarCategorias,
  listarCuentas,
  type ConsultaMeAlcanza,
  type Contexto,
  type CuentaPorElegir,
  type EntradaMovimiento,
  type FiltroMovimientos,
  type obtenerPlan,
  type OrigenDictado,
  type PropuestaAjuste,
  type PropuestaMovimiento,
  type RespuestaExplicar,
  type ResultadoTexto,
  type ResumenMovimiento,
  type CambiosResueltos,
} from '../servicios';
import { PIE_EXPLICAR } from '../servicios/explicar';
import { contextoInterprete } from '../servicios/registrar';
import { formatearCentavos } from '../ui/formato';
import { MENSAJE_SIN_PAREJA } from '../pantallas/compartido/textos';
import { describirRegla } from '../pantallas/onboarding/pagos-fijos';
import { mensajeCuentaDividida } from '../pantallas/personas/textos';
import { mensajeLimite } from '../pantallas/plan/textos';
import type { PrellenadoMovimiento } from '../pantallas/principal/FormularioMovimiento';
import {
  AYUDA_SALDO_DICHO,
  BTN_GUARDAR_INGRESO,
  BTN_GUARDAR_SALDO,
  encabezadoFecha,
  MENSAJE_EXPLICAR_ERROR,
  MENSAJE_EXPLICAR_SIN_RED,
  MENSAJE_EXPLICAR_SOLO_PLUS,
  MENSAJE_GUARDADA,
  MENSAJE_NO_ENCONTRE,
  MENSAJE_NO_SOPORTADO,
  MENSAJE_SIN_DUPLICADOS,
  mensajeAnulado,
  mensajeColchonDicho,
  mensajeConfigurado,
  mensajeCorregido,
  mensajeFueraDeAlcance,
  mensajeIngresoDicho,
  mensajePasarAMeses,
  mensajeSaldoDicho,
  NOMBRE_TIPO,
  nombreTipoLibro,
  preguntaCuentaConfirmacionRegistro,
  resumenMovimiento,
  TEXTO_INGRESO_ANTES,
  TEXTO_INGRESO_DESPUES,
  TEXTO_SALDO_APP,
  TITULO_CONFIRMAR_INGRESO,
  TITULO_CONFIRMAR_REGISTRO,
  TITULO_CONFIRMAR_SALDO,
  TITULO_ELEGIR_CUENTA_SALDO,
} from '../pantallas/principal/textos';
import {
  BTN_CAMBIAR,
  BTN_SI_GUARDALO,
  BTN_SI_REGISTRALO,
  CHIP_ES_GASTO,
  CHIP_ES_INGRESO,
  CHIP_ESCRIBIRLO,
  FILA_CATEGORIA,
  FILA_CUANDO,
  FILA_CUENTA,
  FILA_QUE,
  MOTIVO_ELIGE_CUENTA,
  pistaCorregirRegistro,
  pistaDecirSi,
  TEXTO_DESHICE,
  TEXTO_EXPLICANDO,
  TEXTO_FRASE_LARGA,
  TEXTO_NO_ENTENDI_VACIO,
  TITULO_ENTENDI_GUARDO,
  TITULO_ENTENDI_REGISTRO,
  tituloEntendiDe,
  VALOR_SIN_ELEGIR,
  valorCuando,
} from '../pantallas/asistente/textos';
import { mensajeTarjetaConfigurada, mensajeCompraMsi } from '../pantallas/tarjetas/textos';
import { mensajeAportacion, mensajeCobro } from '../pantallas/tandas/textos';
import type { FilaEntendi, PropuestaEntendi } from '../ui/entendi';
import type { CambioConfirmacion } from './confirmacion-voz';
import { chipQueNombra, idTurnoRegistro, type TurnoConversacion } from './conversacion';
import { FLUJOS, responderPaso, siguientePregunta, type FlujoConversacional } from './flujos';
import { turnosPuedoGastar } from './puedo-gastar';
import { sugerirReparacion } from './reparacion';
import type { CambioRegistro, ChipRespuesta, IdFlujo, Respuesta, Turno } from './tipos';

/**
 * De `ResultadoTexto` a turnos del asistente (Ola 7 §3, §4): registrado → «Registré… · Deshacer»; confirmar* →
 * «Entendí» (R1); lo que no se entendió → «No entendí» con reparación en un toque. Ninguna cifra se calcula aquí:
 * salen del resultado del servicio y de `cambioDia` (que la pantalla lee de `obtenerHoy`, regla 4).
 */

/** Lo que se abre en R2: lo dicho, más lo que se oyó y la frase de «Por revisar» que se descarta al guardar. */
export interface PrellenadoR2 extends PrellenadoMovimiento {
  readonly oido?: string;
  readonly porInterpretarId?: string;
}

type Plan = ReturnType<typeof obtenerPlan>['plan'];

export interface AccionesRegistro {
  readonly porVoz: boolean;
  /** Lo que se dijo o escribió (para «Esto oí» y la reparación); nunca va a logs (regla 9). */
  readonly oido: string;
  readonly plan: Plan;
  readonly nuevoId: (prefijo: string) => string;
  /** «Tu día pasa de $220 a $214.» leído después de escribir; `null` si no cambió o no hay cifra. */
  readonly cambioDia: () => string | null;
  /** Revierte con asientos espejo (`servicios/deshacer`) y refresca; lanza si no se pudo. */
  readonly deshacer: (token: string) => void;
  readonly agregar: (...turnos: TurnoConversacion[]) => void;
  readonly reemplazar: (turno: TurnoConversacion) => void;
  /**
   * Tras guardar sin pasar por `mostrar` (el «Sí» de un flujo o de un ajuste dicho): la cabecera, Cuentas y
   * Movimientos vuelven a leer el libro.
   */
  readonly refrescar?: () => void;
  /** Muestra otro resultado (p. ej. tras «Sí, regístralo»); `reemplaza` es el turno que se va. */
  readonly mostrar: (r: ResultadoTexto, reemplaza?: string) => void;
  /** Manda una frase como si la persona la dijera (aclarar, reparación con la frase reescrita). */
  readonly enviar: (frase: string) => void;
  /** Abre el teclado con lo oído para corregirlo. */
  readonly corregirOido: (oido: string) => void;
  readonly abrirR2: (p: PrellenadoR2) => void;
  readonly verMovimientos: (filtro?: FiltroMovimientos) => void;
  readonly verMovimiento?: (transaccionId: string) => void;
  readonly abrirMeAlcanza?: (consulta: ConsultaMeAlcanza) => void;
  readonly abrirArqueo?: (efectivoReal: Centavos) => void;
  /** Ajustes › Ingreso («Cambiar» del ingreso dicho). */
  readonly abrirIngreso?: () => void;
  /** Ruta de expo-router del formulario largo de un flujo («Cambiar algo»). */
  readonly abrirRuta?: (ruta: string | { pathname: string; params: Record<string, string> }) => void;
  /** Modo explicar (Plus): la pantalla llama `explicar` y reemplaza el turno `id`. */
  readonly explicar?: (pregunta: string, id: string) => void;
  /** «¿Puedo gastar?» con Plus: calcula las opciones (`meAlcanza`) y reemplaza el turno `id`. */
  readonly calcularPuedoGastar?: (consulta: ConsultaMeAlcanza, id: string) => void;
  /** Flujos conversacionales (§6); por omisión `FLUJOS` (inyectable en pruebas). */
  readonly flujos?: Partial<Record<IdFlujo, FlujoConversacional<unknown>>>;
}

type Confirmar = Extract<ResultadoTexto, { resultado: 'confirmar' }>;
type ConfirmarAjuste = Extract<ResultadoTexto, { resultado: 'confirmar_ajuste' }>;

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function conPunto(t: string): string {
  return /[.?…»]$/.test(t) ? t : `${t}.`;
}

/** «Registré: Tele $12,000…» (avisos de antes) → «Registré Tele $12,000….», como el resto de la conversación. */
export function textoDeAviso(mensaje: string): string {
  return conPunto(mensaje.replace(/^Registré: /, 'Registré '));
}

function origenDe(o: AccionesRegistro): OrigenDictado {
  return o.porVoz ? 'voz' : 'texto';
}

/** «Registré Coca $25 · Antojos · Efectivo.» (sin dos puntos, como en la maqueta). */
export function textoRegistrado(movimientos: readonly ResumenMovimiento[]): string {
  return `Registré ${movimientos.map(resumenMovimiento).join('; ')}.`;
}

/**
 * Turno «Registré…» con Deshacer: al deshacer, el mismo turno dice «Deshice el registro» (el libro escribe la
 * transacción espejo, regla 2).
 */
export function turnoRegistro(
  o: Pick<AccionesRegistro, 'deshacer' | 'reemplazar' | 'cambioDia'> &
    Partial<Pick<AccionesRegistro, 'verMovimiento'>>,
  datos: {
    readonly id: string;
    readonly texto: string;
    /** Segunda línea («Cobras $5,000 el jue 26 nov.»). */
    readonly detalle?: string;
    readonly deshacer?: string | null;
    readonly transaccionId?: string;
    readonly cambioDia?: string | null;
    /** Lo de la tarjeta de B2 (`tarjetaRegistro`): movimiento, chips y pista. */
    readonly tarjeta?: DatosTarjetaRegistro;
  },
): Extract<Turno, { clase: 'registro' }> {
  const cambio = datos.cambioDia === undefined ? o.cambioDia() : datos.cambioDia;
  const ver = o.verMovimiento;
  const token = datos.deshacer;
  const transaccion = datos.transaccionId;
  const base: Extract<Turno, { clase: 'registro' }> = {
    id: datos.id,
    de: 'asistente',
    clase: 'registro',
    texto: datos.texto,
    ...(datos.detalle ? { detalle: datos.detalle } : {}),
    ...(cambio ? { cambioDia: cambio } : {}),
    ...(ver && transaccion ? { abrir: () => ver(transaccion) } : {}),
    ...(datos.tarjeta ?? {}),
  };
  if (!token) return base;
  return {
    ...base,
    deshacer: () => {
      o.deshacer(token);
      o.reemplazar({ id: datos.id, de: 'asistente', clase: 'registro', texto: TEXTO_DESHICE });
    },
  };
}

type TurnoRegistroB = Extract<Turno, { clase: 'registro' }>;
type DatosTarjetaRegistro = Partial<Pick<TurnoRegistroB, 'movimiento' | 'cambios' | 'pista' | 'corregido'>>;

/** «Hoy», «Ayer», «Antier» o «Vie 23». */
function etiquetaDia(fecha: PlainDate, hoy: PlainDate): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  if (fecha === sumarDias(hoy, -2)) return 'Antier';
  return capitalizar(etiquetaFecha(fecha));
}

/**
 * La tarjeta de un registro (tablero B2 con los chips de C2): qué y cuánto, categoría · cuenta · día y, para cada
 * uno, sus opciones; elegir otra corrige el movimiento (`aplicarCorreccion`: anula y registra, regla 2) y el turno
 * se rehace como «Listo, lo corregí.». Vacío si el movimiento no es simple (varios asientos) o no se pudo leer: ese
 * turno se queda con su frase.
 */
export function tarjetaRegistro(
  ctx: Contexto,
  transaccionId: string,
  o: Pick<AccionesRegistro, 'mostrar'>,
  idTurno: string,
  corregido = false,
): DatosTarjetaRegistro {
  let leido: ReturnType<typeof detalleRegistro>;
  try {
    leido = detalleRegistro(ctx, transaccionId);
  } catch {
    return {};
  }
  if (!leido) return {};
  const d = leido;
  const hoy = ctx.reloj.hoy();
  const corregir = (cambios: CambiosResueltos) => {
    const r = aplicarCorreccion(ctx, transaccionId, cambios, { origen: 'manual' });
    o.mostrar({ resultado: 'corregido', ...r }, idTurno);
  };
  const cuentas = cuentasDe(ctx);
  const cambios: CambioRegistro[] = [];
  const categoria = d.categoria;
  if (d.corregible.categoria && categoria) {
    cambios.push({
      clave: 'categoria',
      actual: categoria.nombre,
      valor: categoria.slug,
      opciones: listarCategorias(ctx, categoria.naturaleza).map((c) => ({
        valor: c.slug,
        etiqueta: c.nombre,
      })),
      elegir: (slug) => corregir({ categoria: slug }),
    });
  }
  if (d.corregible.cuenta && cuentas.length > 0) {
    cambios.push({
      clave: 'cuenta',
      actual: d.cuenta?.nombre ?? 'Por asignar',
      valor: d.cuenta?.id ?? '',
      opciones: cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
      elegir: (id) => corregir({ origenId: id }),
    });
  }
  if (d.corregible.fecha) {
    const dias: PlainDate[] = [hoy, sumarDias(hoy, -1), sumarDias(hoy, -2)];
    if (!dias.includes(d.fecha)) dias.push(d.fecha);
    cambios.push({
      clave: 'dia',
      actual: etiquetaDia(d.fecha, hoy),
      valor: d.fecha,
      opciones: dias.map((fecha) => ({ valor: fecha, etiqueta: etiquetaDia(fecha, hoy) })),
      elegir: (fecha) => corregir({ fecha: fecha as PlainDate }),
    });
  }
  const otra =
    cuentas.find((c) => c.id !== d.cuenta?.id && c.clase === 'tarjeta') ??
    cuentas.find((c) => c.id !== d.cuenta?.id);
  return {
    movimiento: {
      descripcion: capitalizar(d.descripcion ?? nombreTipoLibro(d.tipo).toLowerCase()),
      montoTexto: `${d.sentido === 'entrada' ? '+' : ''}${formatearCentavos(d.monto)}`,
      categoria: categoria?.nombre ?? null,
      categoriaSlug: categoria?.slug ?? null,
      cuenta: d.cuenta?.nombre ?? 'por asignar',
      cuando: etiquetaDia(d.fecha, hoy).toLowerCase(),
    },
    cambios,
    pista: pistaCorregirRegistro(otra?.nombre ?? null),
    ...(corregido ? { corregido: true } : {}),
  };
}

function turnoTexto(
  id: string,
  texto: string,
  verMovimientos?: () => void,
): Extract<Turno, { clase: 'texto' }> {
  return { id, de: 'asistente', clase: 'texto', texto, ...(verMovimientos ? { verMovimientos } : {}) };
}

// ——— Cuentas y categorías para las filas de «Entendí» ———

interface CuentaNombre {
  readonly id: string;
  readonly nombre: string;
  readonly clase: 'efectivo' | 'liquida' | 'tarjeta';
}

function cuentasDe(ctx: Contexto): CuentaNombre[] {
  const v = listarCuentas(ctx);
  return [
    ...v.tienes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      clase: c.subtipo === 'efectivo' ? ('efectivo' as const) : ('liquida' as const),
    })),
    ...v.debes
      .filter((d) => d.tipo === 'tarjeta')
      .map((d) => ({ id: d.id, nombre: d.nombre, clase: 'tarjeta' as const })),
  ];
}

/** Qué cuenta se elige en cada tipo y de qué clases (las mismas que el formulario). */
const CAMPO_CUENTA: Partial<
  Record<
    EntradaMovimiento['tipo'],
    { campo: 'origenId' | 'destinoId'; clases: readonly CuentaNombre['clase'][] }
  >
> = {
  gasto: { campo: 'origenId', clases: ['efectivo', 'liquida', 'tarjeta'] },
  ingreso: { campo: 'destinoId', clases: ['efectivo', 'liquida'] },
  pago_tarjeta: { campo: 'origenId', clases: ['efectivo', 'liquida'] },
  transferencia: { campo: 'origenId', clases: ['efectivo', 'liquida'] },
  retiro_efectivo: { campo: 'origenId', clases: ['liquida', 'tarjeta'] },
  prestamo_otorgado: { campo: 'origenId', clases: ['efectivo', 'liquida'] },
  pago_prestamo: { campo: 'origenId', clases: ['efectivo', 'liquida'] },
  prestamo_recibido: { campo: 'destinoId', clases: ['efectivo', 'liquida'] },
  cobro_prestamo: { campo: 'destinoId', clases: ['efectivo', 'liquida'] },
};

function relativo(fecha: PlainDate, hoy: PlainDate): 'hoy' | 'ayer' | null {
  if (fecha === hoy) return 'hoy';
  return fecha === sumarDias(hoy, -1) ? 'ayer' : null;
}

function cuandoDe(fecha: PlainDate, hoy: PlainDate): string {
  return valorCuando(encabezadoFecha(etiquetaFecha(fecha), etiquetaDiaMes(fecha)), relativo(fecha, hoy));
}

// ——— «Entendí» de un movimiento (confirmar) ———

interface EstadoConfirmar {
  readonly id: string;
  readonly r: Confirmar;
  /** `<i>:<campo>` → cuenta elegida. */
  readonly elecciones: Readonly<Record<string, string>>;
  /** Categoría cambiada en la tarjeta, por movimiento. */
  readonly categorias: Readonly<Record<number, string>>;
  /** Monto y fecha corregidos de viva voz («eran 40», «fue ayer»), por movimiento. */
  readonly montos?: Readonly<Record<number, Centavos>>;
  readonly fechas?: Readonly<Record<number, PlainDate>>;
}

/**
 * Lo que se dijo sobre una tarjeta «Entendí» de registro («no, fue con la Nu», «eran 40», «ponle comida», «fue
 * ayer»), ya leído por `leerConfirmacion` (A-2): cada propuesta guarda cómo rehacerse con esos cambios.
 */
interface InfoEntendi {
  readonly movimiento: 'gasto' | 'ingreso' | null;
  readonly corregir: (cambios: readonly CambioConfirmacion[]) => TurnoConversacion | null;
}
const infoEntendi = new WeakMap<PropuestaEntendi, InfoEntendi>();

/** Qué registra la tarjeta (acota las categorías al leer la respuesta); `null` si no es de un movimiento. */
export function movimientoDeEntendi(propuesta: PropuestaEntendi): 'gasto' | 'ingreso' | null {
  return infoEntendi.get(propuesta)?.movimiento ?? null;
}

/** La tarjeta rehecha con los cambios dichos (mismo id); `null` si no aplica ninguno. */
export function corregirEntendi(
  propuesta: PropuestaEntendi,
  cambios: readonly CambioConfirmacion[],
): TurnoConversacion | null {
  return infoEntendi.get(propuesta)?.corregir(cambios) ?? null;
}

/** La cuenta que nombra una referencia dicha (alias o tipo), entre las que admite la fila. */
function cuentaDeRef(
  ref: { readonly tipo: string; readonly alias?: string | undefined },
  cuentas: readonly CuentaNombre[],
): string | null {
  if (ref.alias)
    return (
      chipQueNombra(
        cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        ref.alias,
      )?.valor ?? null
    );
  const clases: Record<string, CuentaNombre['clase'][]> = {
    efectivo: ['efectivo'],
    debito: ['liquida'],
    credito: ['tarjeta'],
  };
  const posibles = cuentas.filter((c) => clases[ref.tipo]?.includes(c.clase));
  return posibles.length === 1 ? (posibles[0]?.id ?? null) : null;
}

const clave = (i: number, campo: CuentaPorElegir['campo']) => `${i}:${campo}`;

/** Lo aproximado con una sola candidata viene elegido (como la tarjeta de confirmación de siempre). */
function eleccionesIniciales(propuestas: readonly PropuestaMovimiento[]): Record<string, string> {
  const inicial: Record<string, string> = {};
  propuestas.forEach((p, i) =>
    p.faltan.forEach((f) => {
      const unica = f.candidatas[0];
      if (f.motivo === 'aproximado' && f.candidatas.length === 1 && unica)
        inicial[clave(i, f.campo)] = unica.id;
    }),
  );
  return inicial;
}

function entradasDe(est: EstadoConfirmar): EntradaMovimiento[] {
  return est.r.propuestas.map((p, i) => {
    // La cuenta elegida (la que faltaba o la que se cambió en la fila) gana sobre la interpretada.
    const extra: Record<string, string> = {};
    for (const campo of ['origenId', 'destinoId'] as const) {
      const id = est.elecciones[clave(i, campo)];
      if (id) extra[campo] = id;
    }
    const categoria = est.categorias[i];
    const monto = est.montos?.[i];
    const fecha = est.fechas?.[i];
    return {
      ...p.entrada,
      ...extra,
      ...(categoria ? { categoria } : {}),
      ...(monto !== undefined ? { monto } : {}),
      ...(fecha ? { fecha } : {}),
    } as EntradaMovimiento;
  });
}

/** Aplica los cambios dichos a la única propuesta de la tarjeta; el mismo estado si ninguno aplica. */
function conCambios(
  ctx: Contexto,
  est: EstadoConfirmar,
  cambios: readonly CambioConfirmacion[],
  cuentas: readonly CuentaNombre[],
): EstadoConfirmar {
  const p = est.r.propuestas[0];
  if (!p || est.r.propuestas.length !== 1) return est;
  const campo = CAMPO_CUENTA[p.entrada.tipo];
  let siguiente = est;
  for (const c of cambios) {
    if (c.fila === 'monto') siguiente = { ...siguiente, montos: { ...siguiente.montos, 0: c.monto } };
    else if (c.fila === 'cuando') siguiente = { ...siguiente, fechas: { ...siguiente.fechas, 0: c.fecha } };
    else if (c.fila === 'categoria') {
      const tipo = p.entrada.tipo === 'ingreso' ? 'ingreso' : 'gasto';
      if (listarCategorias(ctx, tipo).some((x) => x.slug === c.categoria))
        siguiente = { ...siguiente, categorias: { ...siguiente.categorias, 0: c.categoria } };
    } else if (c.fila === 'cuenta' && campo) {
      const id = cuentaDeRef(
        c.cuenta,
        cuentas.filter((x) => campo.clases.includes(x.clase)),
      );
      if (id)
        siguiente = { ...siguiente, elecciones: { ...siguiente.elecciones, [clave(0, campo.campo)]: id } };
    }
  }
  return siguiente;
}

function turnoConfirmar(ctx: Contexto, est: EstadoConfirmar, o: AccionesRegistro): TurnoConversacion {
  const cuentas = cuentasDe(ctx);
  // Una pregunta a la vez: primero la cuenta que falta (02 §1.2), después «Entendí».
  for (const [i, p] of est.r.propuestas.entries()) {
    for (const f of p.faltan) {
      if (est.elecciones[clave(i, f.campo)]) continue;
      const opciones = (
        f.candidatas.length > 0
          ? f.candidatas
          : cuentas.filter((c) => CAMPO_CUENTA[p.entrada.tipo]?.clases.includes(c.clase) ?? true)
      ).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
      const texto = preguntaCuentaConfirmacionRegistro(f);
      return {
        id: est.id,
        de: 'asistente',
        clase: 'pregunta',
        texto,
        chips: opciones,
        responder: (resp) => {
          const elegida = elegirChip(opciones, resp);
          if (!elegida) return;
          o.reemplazar(turnoTexto(est.id, texto));
          const siguiente: EstadoConfirmar = {
            ...est,
            id: o.nuevoId('confirmar'),
            elecciones: { ...est.elecciones, [clave(i, f.campo)]: elegida.valor },
          };
          o.agregar(turnoPersona(o, elegida.etiqueta, resp), turnoConfirmar(ctx, siguiente, o));
        },
      };
    }
  }
  return {
    id: est.id,
    de: 'asistente',
    clase: 'entendi',
    propuesta: propuestaConfirmar(ctx, est, cuentas, o),
  };
}

function elegirChip(chips: readonly ChipRespuesta[], r: Respuesta): ChipRespuesta | null {
  if (r.tipo === 'chip') return chips.find((c) => c.valor === r.valor) ?? null;
  return null;
}

function etiquetaRespuesta(chips: readonly ChipRespuesta[], r: Respuesta): string {
  if (r.tipo === 'chip') return chips.find((c) => c.valor === r.valor)?.etiqueta ?? r.valor;
  if (r.tipo === 'monto') return formatearCentavos(r.centavos);
  return r.texto;
}

function turnoPersona(o: Pick<AccionesRegistro, 'nuevoId'>, texto: string, r: Respuesta): TurnoConversacion {
  return {
    id: o.nuevoId('persona'),
    de: 'persona',
    texto,
    porVoz: r.tipo === 'texto' && r.porVoz,
  };
}

function propuestaConfirmar(
  ctx: Contexto,
  est: EstadoConfirmar,
  cuentas: readonly CuentaNombre[],
  o: AccionesRegistro,
): PropuestaEntendi {
  const hoy = ctx.reloj.hoy();
  const entradas = entradasDe(est);
  const cambiar = (siguiente: EstadoConfirmar) => o.reemplazar(turnoConfirmar(ctx, siguiente, o));
  const nombre = (id: string | undefined) => cuentas.find((c) => c.id === id)?.nombre ?? VALOR_SIN_ELEGIR;
  const filas: FilaEntendi[] = [];
  let otraCuenta: string | null = null;
  if (entradas.length === 1) {
    const e = entradas[0] as EntradaMovimiento;
    const p = est.r.propuestas[0] as PropuestaMovimiento;
    filas.push({
      clave: 'que',
      etiqueta: FILA_QUE,
      valor: capitalizar(e.descripcion ?? NOMBRE_TIPO[e.tipo]),
    });
    const campo = CAMPO_CUENTA[e.tipo];
    if (campo) {
      const actual = (e as Record<string, unknown>)[campo.campo] as string | undefined;
      const falta = p.faltan.find((f) => f.campo === campo.campo);
      const opciones = (
        falta && falta.candidatas.length > 1
          ? falta.candidatas
          : cuentas.filter((c) => campo.clases.includes(c.clase))
      ).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
      otraCuenta = opciones.find((x) => x.valor !== actual)?.etiqueta ?? null;
      filas.push({
        clave: 'cuenta',
        etiqueta: FILA_CUENTA,
        valor: nombre(actual),
        opciones,
        alCambiar: (valor) =>
          cambiar({ ...est, elecciones: { ...est.elecciones, [clave(0, campo.campo)]: valor } }),
      });
    }
    if (e.tipo === 'gasto' || e.tipo === 'ingreso') {
      const categorias = listarCategorias(ctx, e.tipo);
      filas.push({
        clave: 'categoria',
        etiqueta: FILA_CATEGORIA,
        valor: categorias.find((c) => c.slug === e.categoria)?.nombre ?? VALOR_SIN_ELEGIR,
        opciones: categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre })),
        alCambiar: (valor) => cambiar({ ...est, categorias: { ...est.categorias, 0: valor } }),
      });
    }
    filas.push({ clave: 'cuando', etiqueta: FILA_CUANDO, valor: cuandoDe(e.fecha ?? hoy, hoy) });
  } else {
    entradas.forEach((e, i) => {
      const campo = CAMPO_CUENTA[e.tipo];
      const cuenta = campo ? nombre((e as Record<string, unknown>)[campo.campo] as string | undefined) : null;
      filas.push({
        clave: `movimiento-${i}`,
        etiqueta: e.descripcion ?? NOMBRE_TIPO[e.tipo],
        valor: cuenta ? `${formatearCentavos(e.monto)} · ${cuenta}` : formatearCentavos(e.monto),
      });
    });
  }
  const primera = entradas[0];
  const motivo = est.r.motivo;
  // Sin cuenta no hay asiento posible: «Sí» queda inactivo hasta que se elija en la fila (la pregunta de la cuenta
  // que falta llega antes, pero una propuesta puede venir sin cuenta y sin `faltan`).
  const sinCuenta = entradas.some((e) => {
    const campo = CAMPO_CUENTA[e.tipo];
    return campo !== undefined && !(e as Record<string, unknown>)[campo.campo];
  });
  const aprender = est.r.propuestas.flatMap((p, i) =>
    p.faltan.flatMap((f) => {
      const id = est.elecciones[clave(i, f.campo)];
      return f.alias && id && f.motivo !== 'ambigua' ? [{ alias: f.alias, cuentaId: id }] : [];
    }),
  );
  const propuesta: PropuestaEntendi = {
    titulo: TITULO_ENTENDI_REGISTRO,
    ...(entradas.length === 1 && primera ? { monto: primera.monto } : {}),
    filas,
    ...(motivo === 'monto_alto' || motivo === 'impuestos'
      ? { efecto: TITULO_CONFIRMAR_REGISTRO[motivo] }
      : {}),
    confirmar: {
      etiqueta: BTN_SI_REGISTRALO,
      ...(sinCuenta ? { deshabilitado: true, motivoDeshabilitado: MOTIVO_ELIGE_CUENTA } : {}),
      accion: () => {
        const r = confirmarRegistro(ctx, entradas, origenDe(o), { aprender });
        o.mostrar(r, est.id);
      },
    },
    ...(primera
      ? {
          cambiar: {
            etiqueta: BTN_CAMBIAR,
            accion: () => o.abrirR2({ ...prellenadoDe(primera), oido: o.oido }),
          },
        }
      : {}),
    ...(o.porVoz ? { pista: pistaDecirSi(otraCuenta) } : {}),
  };
  infoEntendi.set(propuesta, {
    movimiento:
      entradas.length === 1 && (primera?.tipo === 'gasto' || primera?.tipo === 'ingreso')
        ? primera.tipo
        : null,
    corregir: (cambios) => {
      const siguiente = conCambios(ctx, est, cambios, cuentas);
      return siguiente === est ? null : turnoConfirmar(ctx, siguiente, o);
    },
  });
  return propuesta;
}

/** Lo que va a R2 desde una entrada ya interpretada. */
export function prellenadoDe(e: EntradaMovimiento): PrellenadoMovimiento {
  const campos = e as Partial<Record<'origenId' | 'destinoId' | 'categoria', string>>;
  const cuentaId = CAMPO_CUENTA[e.tipo]?.campo === 'destinoId' ? campos.destinoId : campos.origenId;
  return {
    tipo: e.tipo,
    monto: e.monto,
    ...(e.descripcion ? { descripcion: e.descripcion } : {}),
    ...(cuentaId ? { cuentaId } : {}),
    ...(campos.origenId && campos.destinoId ? { destinoId: campos.destinoId } : {}),
    ...(campos.categoria ? { categoria: campos.categoria } : {}),
    ...(e.fecha ? { fecha: e.fecha } : {}),
  };
}

// ——— «Entendí» del ingreso, el saldo y el colchón dichos (confirmar_ajuste) ———

interface EstadoAjuste {
  readonly id: string;
  readonly propuesta: PropuestaAjuste;
  readonly cuentaId: string | null;
}

function nombreCuentaSaldo(p: PropuestaAjuste, cuentaId: string | null): string {
  if (p.tipo !== 'saldo_cuenta') return '';
  return p.faltaCuenta?.candidatas.find((c) => c.id === cuentaId)?.nombre ?? 'tu cuenta';
}

function turnoAjuste(ctx: Contexto, est: EstadoAjuste, o: AccionesRegistro): TurnoConversacion {
  const p = est.propuesta;
  if (p.tipo === 'saldo_cuenta' && est.cuentaId === null) {
    const chips = (p.faltaCuenta?.candidatas ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
    return {
      id: est.id,
      de: 'asistente',
      clase: 'pregunta',
      texto: TITULO_ELEGIR_CUENTA_SALDO,
      ayuda: AYUDA_SALDO_DICHO,
      chips,
      responder: (r) => {
        const elegida = elegirChip(chips, r);
        if (!elegida) return;
        o.reemplazar(turnoTexto(est.id, TITULO_ELEGIR_CUENTA_SALDO));
        o.agregar(
          turnoPersona(o, elegida.etiqueta, r),
          turnoAjuste(ctx, { ...est, id: o.nuevoId('ajuste'), cuentaId: elegida.valor }, o),
        );
      },
    };
  }
  const guardar = (): void => {
    const g = confirmarAjuste(ctx, p, origenDe(o), est.cuentaId ? { cuentaId: est.cuentaId } : {});
    let texto: string;
    if (g.tipo === 'ingreso' && p.tipo === 'ingreso') {
      texto = mensajeIngresoDicho(
        p.monto,
        describirRegla(p.regla),
        p.proximoPago ? etiquetaFecha(p.proximoPago) : null,
      );
    } else if (g.tipo === 'saldo_cuenta') {
      texto = mensajeSaldoDicho(nombreCuentaSaldo(p, g.cuentaId), g.saldo, g.transaccionId !== null);
    } else {
      texto = mensajeColchonDicho(p.monto);
    }
    o.reemplazar(turnoRegistro(o, { id: est.id, texto }));
    o.refrescar?.();
  };
  let propuesta: PropuestaEntendi;
  if (p.tipo === 'ingreso') {
    const despues = p.proximoPago
      ? `${describirRegla(p.regla)} · próximo pago ${etiquetaFecha(p.proximoPago)}`
      : describirRegla(p.regla);
    const abrirIngreso = o.abrirIngreso;
    propuesta = {
      titulo: tituloEntendiDe(TITULO_CONFIRMAR_INGRESO),
      monto: p.monto,
      filas: [
        ...(p.anterior
          ? [
              {
                clave: 'antes',
                etiqueta: TEXTO_INGRESO_ANTES,
                valor: `${p.anterior.concepto} · ${formatearCentavos(p.anterior.monto)}`,
              },
            ]
          : []),
        { clave: 'despues', etiqueta: TEXTO_INGRESO_DESPUES, valor: despues },
      ],
      confirmar: { etiqueta: BTN_GUARDAR_INGRESO, accion: guardar },
      ...(abrirIngreso ? { cambiar: { etiqueta: BTN_CAMBIAR, accion: abrirIngreso } } : {}),
    };
  } else if (p.tipo === 'saldo_cuenta') {
    const chips = (p.faltaCuenta?.candidatas ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre }));
    propuesta = {
      titulo: tituloEntendiDe(TITULO_CONFIRMAR_SALDO),
      monto: p.monto,
      filas: [
        {
          clave: 'cuenta',
          etiqueta: FILA_CUENTA,
          valor: nombreCuentaSaldo(p, est.cuentaId),
          ...(chips.length > 1
            ? {
                opciones: chips,
                alCambiar: (valor: string) => o.reemplazar(turnoAjuste(ctx, { ...est, cuentaId: valor }, o)),
              }
            : {}),
        },
        ...(p.saldoActual !== null && est.cuentaId === p.cuentaId
          ? [{ clave: 'app', etiqueta: TEXTO_SALDO_APP, valor: formatearCentavos(p.saldoActual) }]
          : []),
      ],
      efecto: AYUDA_SALDO_DICHO,
      confirmar: { etiqueta: BTN_GUARDAR_SALDO, accion: guardar },
    };
  } else {
    propuesta = {
      titulo: TITULO_ENTENDI_GUARDO,
      monto: p.monto,
      filas: [{ clave: 'colchon', etiqueta: 'Colchón', valor: `Hoy apartas ${formatearCentavos(p.actual)}` }],
      confirmar: { etiqueta: BTN_SI_GUARDALO, accion: guardar },
    };
  }
  return { id: est.id, de: 'asistente', clase: 'entendi', propuesta };
}

// ——— Flujos conversacionales (§6, A-3) ———

interface EstadoFlujo {
  readonly id: string;
  readonly flujo: FlujoConversacional<unknown>;
  readonly e: unknown;
  readonly error?: string;
}

function esError(x: unknown): x is { readonly error: string } {
  return typeof x === 'object' && x !== null && typeof (x as { error?: unknown }).error === 'string';
}

/**
 * Pregunta lo que falta (`siguientePregunta`: cada paso se omite solo cuando ya está en el estado) y, cuando ya no
 * falta nada, «Entendí» con «Sí» → `guardar` y «Cambiar algo» → el formulario largo. Tocar una fila (`actualizar`)
 * rehace el turno: si el cambio abrió un hueco, primero pregunta.
 */
function turnoDeFlujo(ctx: Contexto, est: EstadoFlujo, o: AccionesRegistro): TurnoConversacion {
  const pregunta = siguientePregunta(est.flujo, est.e);
  if (pregunta) {
    return {
      id: est.id,
      de: 'asistente',
      clase: 'pregunta',
      texto: pregunta.texto,
      ...(est.error ? { ayuda: est.error } : pregunta.ayuda ? { ayuda: pregunta.ayuda } : {}),
      chips: pregunta.chips,
      ...(pregunta.campo ? { campo: pregunta.campo } : {}),
      ...(pregunta.admiteCero ? { admiteCero: true } : {}),
      responder: (r) => {
        const res = responderPaso(est.flujo, est.e, pregunta.paso, r);
        if (esError(res)) {
          o.reemplazar(turnoDeFlujo(ctx, { ...est, error: res.error }, o));
          return;
        }
        o.reemplazar(turnoTexto(est.id, pregunta.texto));
        o.agregar(
          turnoPersona(o, etiquetaRespuesta(pregunta.chips, r), r),
          turnoDeFlujo(ctx, { id: o.nuevoId('flujo'), flujo: est.flujo, e: res }, o),
        );
      },
    };
  }
  const abrirRuta = o.abrirRuta;
  const propuesta = est.flujo.entendi(ctx, est.e, {
    guardar: async () => {
      const m = await est.flujo.guardar(ctx, est.e);
      o.reemplazar(
        turnoRegistro(o, {
          id: est.id,
          texto: m.texto,
          ...(m.detalle ? { detalle: m.detalle } : {}),
          ...(m.deshacer ? { deshacer: m.deshacer } : {}),
          ...(m.cambioDia !== undefined ? { cambioDia: m.cambioDia } : {}),
        }),
      );
      o.refrescar?.();
    },
    cambiar: () => abrirRuta?.(est.flujo.formularioLargo(est.e)),
    actualizar: (nuevo) => o.reemplazar(turnoDeFlujo(ctx, { ...est, e: nuevo }, o)),
  });
  return { id: est.id, de: 'asistente', clase: 'entendi', propuesta };
}

/**
 * Turnos de un flujo conversacional (§6) con lo que ya se dijo: la primera pregunta (o «Entendí» si no falta nada),
 * o un texto si no se puede empezar («No tienes efectivo registrado…»). `null` si el flujo no existe.
 */
export function turnosDeFlujo(
  ctx: Contexto,
  id: IdFlujo,
  origen: unknown,
  o: AccionesRegistro,
): TurnoConversacion[] | null {
  const flujo = (o.flujos ?? FLUJOS)[id];
  if (!flujo) return null;
  const motivo = flujo.noDisponible?.(ctx) ?? null;
  if (motivo !== null) return [turnoTexto(o.nuevoId('texto'), motivo)];
  const inicial = flujo.inicial(ctx, { desde: origen, porVoz: o.porVoz });
  return [turnoDeFlujo(ctx, { id: o.nuevoId('flujo'), flujo, e: inicial }, o)];
}

// ——— No entendí, por interpretar y explicar ———

/** Tipos de `sugerirReparacion` (A-2) → tipo de R2 (`otra`: R2 sin tipo). */
const TIPO_REPARACION: Readonly<Record<TipoReparacion, PrellenadoMovimiento['tipo'] | null>> = {
  gasto: 'gasto',
  ingreso: 'ingreso',
  prestamo: 'prestamo_otorgado',
  me_pagaron: 'cobro_prestamo',
  pago_tarjeta: 'pago_tarjeta',
  transferencia: 'transferencia',
  otra: null,
};

/**
 * Turno «No entendí» con las respuestas más probables y «Corregir lo que oí» (§2, criterio 3). Una opción con frase
 * reescrita («le presté 300 a Beto») se manda tal cual al intérprete; las demás abren R2 con su tipo y la cifra oída.
 */
export function turnoNoEntendi(
  ctx: Contexto,
  o: Pick<AccionesRegistro, 'nuevoId' | 'abrirR2' | 'enviar' | 'corregirOido'>,
  oido: string,
  porInterpretarId?: string,
): TurnoConversacion {
  const limpio = oido.trim();
  if (limpio === '') return turnoTexto(o.nuevoId('texto'), TEXTO_NO_ENTENDI_VACIO);
  const opciones = sugerirReparacion(limpio, contextoInterprete(ctx));
  return {
    id: o.nuevoId('no-entendi'),
    de: 'asistente',
    clase: 'no_entendi',
    oido: limpio,
    opciones,
    elegir: (valor) => {
      const opcion = opciones.find((x) => x.valor === valor);
      if (!opcion || opcion.frase !== undefined) {
        // Ya es frase: se manda como si la persona la dijera (el nivel 0 la entiende tal cual).
        o.enviar(opcion?.frase ?? valor);
        return;
      }
      const tipo = TIPO_REPARACION[opcion.tipo];
      o.abrirR2({
        ...(tipo ? { tipo } : {}),
        ...(opcion.monto !== undefined ? { monto: opcion.monto } : {}),
        oido: limpio,
        ...(porInterpretarId ? { porInterpretarId } : {}),
      });
    },
    corregir: () => o.corregirOido(limpio),
  };
}

function turnoPorInterpretar(
  ctx: Contexto,
  r: Extract<ResultadoTexto, { resultado: 'por_interpretar' }>,
  o: AccionesRegistro,
): TurnoConversacion {
  // Sin intérprete en internet la frase no se va a entender sola: «no entendí» con reparación, nunca «cuando
  // tengas internet» (criterio 12).
  if (r.motivo === 'sin_nube') return turnoNoEntendi(ctx, o, o.oido, r.id);
  const texto = (r.limite ? mensajeLimite(r.limite, o.plan) : null) ?? MENSAJE_GUARDADA[r.motivo];
  const chips: ChipRespuesta[] = [
    { valor: 'gasto', etiqueta: CHIP_ES_GASTO },
    { valor: 'ingreso', etiqueta: CHIP_ES_INGRESO },
    { valor: 'escribir', etiqueta: CHIP_ESCRIBIRLO },
  ];
  return {
    id: o.nuevoId('por-interpretar'),
    de: 'asistente',
    clase: 'pregunta',
    texto,
    chips,
    responder: (resp) => {
      if (resp.tipo !== 'chip') return;
      if (resp.valor === 'escribir') return o.corregirOido(o.oido);
      o.abrirR2({
        tipo: resp.valor === 'ingreso' ? 'ingreso' : 'gasto',
        oido: o.oido,
        porInterpretarId: r.id,
      });
    },
  };
}

/** La respuesta del modo explicar (`02 §22`) como turno de texto con «Ver movimientos». */
export function turnoDeExplicacion(
  id: string,
  e: RespuestaExplicar,
  o: Pick<AccionesRegistro, 'verMovimientos'>,
): TurnoConversacion {
  switch (e.tipo) {
    // Lo que contesta el modo explicar siempre dice que responde con tus datos y no es asesoría (`08 §1`).
    case 'explicacion':
      return turnoTexto(id, `${e.texto}\n${PIE_EXPLICAR}`, () => o.verMovimientos(e.filtro));
    case 'plantilla':
      return turnoTexto(id, [e.aviso, ...e.respuestas.map((x) => x.texto), PIE_EXPLICAR].join('\n'), () =>
        o.verMovimientos(e.filtro),
      );
    case 'solo_plus':
      return turnoTexto(id, MENSAJE_EXPLICAR_SOLO_PLUS);
    case 'limite':
      return turnoTexto(id, e.mensaje);
    case 'sin_red':
      return turnoTexto(id, MENSAJE_EXPLICAR_SIN_RED);
    case 'error':
      return turnoTexto(id, MENSAJE_EXPLICAR_ERROR);
  }
}

// ——— Todas las variantes ———

/**
 * Turnos de un resultado (§3). Los que abren otra pantalla (`me_alcanza`, `arqueo` sin flujo) no agregan turnos.
 * `null` o un resultado desconocido → «No entendí» con reparación.
 */
export function turnosDesdeResultado(
  ctx: Contexto,
  r: ResultadoTexto | null | undefined,
  o: AccionesRegistro,
): TurnoConversacion[] {
  if (!r) return [turnoNoEntendi(ctx, o, o.oido)];
  const origen = origenDe(o);
  const reg = (datos: Parameters<typeof turnoRegistro>[1]) => turnoRegistro(o, datos);
  switch (r.resultado) {
    case 'registrado': {
      const ids = r.movimientos.map((m) => m.transaccionId);
      const id = idTurnoRegistro(ids);
      const unico = ids.length === 1 ? ids[0] : undefined;
      const turnos: TurnoConversacion[] = [
        reg({
          id,
          texto: textoRegistrado(r.movimientos),
          deshacer: r.deshacer,
          ...(ids[0] ? { transaccionId: ids[0] } : {}),
          ...(unico ? { tarjeta: tarjetaRegistro(ctx, unico, o, id) } : {}),
        }),
      ];
      if (r.movimientos.some((m) => m.avisoDeducible)) {
        turnos.push(turnoTexto(o.nuevoId('deducible'), AVISO_DEDUCIBLE_EFECTIVO));
      }
      return turnos;
    }
    case 'corregido': {
      const id = idTurnoRegistro([r.despues.transaccionId]);
      return [
        reg({
          id,
          texto: conPunto(mensajeCorregido(r.antes, r.despues)),
          deshacer: r.deshacer,
          transaccionId: r.despues.transaccionId,
          tarjeta: tarjetaRegistro(ctx, r.despues.transaccionId, o, id, true),
        }),
      ];
    }
    case 'anulado':
      return [
        reg({
          id: o.nuevoId('anulado'),
          texto: conPunto(mensajeAnulado(r.movimiento)),
          deshacer: r.deshacer,
        }),
      ];
    case 'pasar_a_meses':
      return [
        reg({
          id: idTurnoRegistro([r.movimiento.transaccionId]),
          texto: mensajePasarAMeses(r.movimiento, r.meses),
          deshacer: r.deshacer,
          transaccionId: r.movimiento.transaccionId,
        }),
      ];
    case 'registrado_msi':
      return [
        reg({
          id: idTurnoRegistro([r.compra.transaccionId]),
          texto: textoDeAviso(mensajeCompraMsi(r.compra)),
          deshacer: r.deshacer,
          transaccionId: r.compra.transaccionId,
        }),
      ];
    case 'registrado_division':
      return [
        reg({
          id: idTurnoRegistro([r.registro.transaccionId]),
          texto: textoDeAviso(
            mensajeCuentaDividida(r.descripcion, r.total, r.registro.reparto.porCobrarTotal),
          ),
          deshacer: r.deshacer,
          transaccionId: r.registro.transaccionId,
        }),
      ];
    case 'registrado_tanda':
      return [
        reg({
          id: idTurnoRegistro([r.movimiento.transaccionId]),
          texto: textoDeAviso(
            r.tipo === 'cobro_tanda' ? mensajeCobro(r.movimiento) : mensajeAportacion(r.movimiento),
          ),
          deshacer: r.movimiento.deshacer,
          transaccionId: r.movimiento.transaccionId,
        }),
      ];
    case 'configurado':
      return [
        reg({
          id: o.nuevoId('configurado'),
          texto: mensajeConfigurado(r.compromiso),
          deshacer: r.compromiso.deshacer,
        }),
      ];
    case 'colchon_configurado':
      return [reg({ id: o.nuevoId('colchon'), texto: mensajeColchonDicho(r.monto), deshacer: r.deshacer })];
    case 'tarjeta_configurada':
      return [
        reg({
          id: o.nuevoId('tarjeta'),
          texto: conPunto(mensajeTarjetaConfigurada(r.tarjeta, r.editada)),
          deshacer: r.deshacer,
        }),
      ];
    case 'confirmar':
      return [
        turnoConfirmar(
          ctx,
          { id: o.nuevoId('confirmar'), r, elecciones: eleccionesIniciales(r.propuestas), categorias: {} },
          o,
        ),
      ];
    case 'confirmar_ajuste':
      return [turnoAjusteInicial(ctx, r, o)];
    case 'confirmar_msi':
      return turnosDeFlujo(ctx, 'msi', r, o) ?? [tarjeta(o, r, origen)];
    case 'confirmar_division':
      return turnosDeFlujo(ctx, 'cuenta_dividida', r, o) ?? [tarjeta(o, r, origen)];
    case 'tarjeta_por_agregar':
      return turnosDeFlujo(ctx, 'tarjeta', r, o) ?? [tarjeta(o, r, origen)];
    case 'tanda_por_crear':
      return turnosDeFlujo(ctx, 'tanda', r, o) ?? [tarjeta(o, r, origen)];
    case 'confirmar_compartido':
    case 'confirmar_tanda':
    case 'elegir':
    case 'duplicados':
      return [tarjeta(o, r, origen)];
    case 'aclarar': {
      const chips = r.opciones.map((x) => ({ valor: x, etiqueta: x }));
      return [
        {
          id: o.nuevoId('aclarar'),
          de: 'asistente',
          clase: 'pregunta',
          texto: r.pregunta,
          chips,
          campo: 'texto',
          responder: (resp) => {
            const opcion = resp.tipo === 'chip' ? resp.valor : resp.tipo === 'texto' ? resp.texto : null;
            if (opcion) o.enviar(`${r.texto}, ${opcion}`);
          },
        },
      ];
    }
    case 'sin_pareja':
      return [
        {
          id: o.nuevoId('sin-pareja'),
          de: 'asistente',
          clase: 'aviso',
          texto: MENSAJE_SIN_PAREJA,
          acciones: [],
          origen: 'sin_pareja',
        },
      ];
    case 'por_interpretar':
      return [turnoPorInterpretar(ctx, r, o)];
    case 'consulta': {
      const filtro = r.respuesta.filtro;
      // Las filas de la plantilla («tanda · mar 13 oct: $674») van debajo de la frase, una por renglón.
      const lineas = r.respuesta.lineas.map((l) => `${l.etiqueta}: ${l.valor}`);
      return [
        turnoTexto(
          o.nuevoId('consulta'),
          [r.respuesta.texto, ...lineas].join('\n'),
          r.respuesta.soloPlus ? undefined : () => o.verMovimientos(filtro),
        ),
      ];
    }
    case 'explicar': {
      const id = o.nuevoId('explicar');
      if (!o.explicar) return [turnoTexto(id, MENSAJE_NO_SOPORTADO.consulta)];
      o.explicar(r.pregunta, id);
      return [turnoTexto(id, TEXTO_EXPLICANDO)];
    }
    case 'me_alcanza':
      // «¿Me alcanza para…?» se contesta aquí mismo, en la conversación (no en otra pantalla).
      return turnosPuedoGastar(ctx, r.consulta, o);
    case 'arqueo': {
      const flujo = turnosDeFlujo(ctx, 'arqueo', r, o);
      if (flujo) return flujo;
      o.abrirArqueo?.(r.efectivoReal);
      return [];
    }
    case 'no_encontrado':
      return [
        turnoTexto(
          o.nuevoId('texto'),
          r.accion === 'duplicados' ? MENSAJE_SIN_DUPLICADOS : MENSAJE_NO_ENCONTRE,
        ),
      ];
    case 'no_entendi':
      return [
        r.motivo === 'texto_largo'
          ? turnoTexto(o.nuevoId('texto'), TEXTO_FRASE_LARGA)
          : turnoNoEntendi(ctx, o, o.oido),
      ];
    case 'no_soportado':
      return [turnoTexto(o.nuevoId('texto'), MENSAJE_NO_SOPORTADO[r.motivo])];
    case 'fuera_de_alcance':
      return [turnoTexto(o.nuevoId('texto'), mensajeFueraDeAlcance(r.motivo))];
    default:
      return [turnoNoEntendi(ctx, o, o.oido)];
  }
}

function tarjeta(
  o: Pick<AccionesRegistro, 'nuevoId'>,
  datos: Extract<TurnoConversacion, { clase: 'tarjeta' }>['datos'],
  origen: OrigenDictado,
): TurnoConversacion {
  return { id: o.nuevoId('tarjeta'), de: 'asistente', clase: 'tarjeta', datos, origen };
}

function turnoAjusteInicial(ctx: Contexto, r: ConfirmarAjuste, o: AccionesRegistro): TurnoConversacion {
  const p = r.propuesta;
  const unica = p.tipo === 'saldo_cuenta' ? p.faltaCuenta?.candidatas : undefined;
  const cuentaId =
    p.tipo === 'saldo_cuenta' ? (p.cuentaId ?? (unica?.length === 1 ? (unica[0]?.id ?? null) : null)) : null;
  return turnoAjuste(ctx, { id: o.nuevoId('ajuste'), propuesta: p, cuentaId }, o);
}
