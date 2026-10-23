import { useCallback, useMemo, useReducer, useRef } from 'react';
import type {
  FiltroMovimientos,
  MovimientoVista,
  Observacion,
  OrigenDictado,
  ResultadoTexto,
  TarjetaAccion,
  VistaHoy,
  VistaProbabilidadHoy,
} from '../servicios';
import { interpretarMonto } from '@cartera/nlu';
import { formatearCentavos, leerPesos } from '../ui/formato';
import { textoObservacion } from '../pantallas/principal/observaciones-textos';
import { nombreTipoLibro, TEXTO_AVISO_RIESGO_HOY } from '../pantallas/principal/textos';
import type { ChipRespuesta, Respuesta, Turno } from './tipos';

/**
 * La conversación del asistente (Ola 7 §2): los turnos que salen del libro y del día (derivados, deterministas)
 * más los de esta sesión (lo que dijiste y lo que contesté), que no se guardan: al relanzar la app solo quedan los
 * derivados. Sin React Native: la pantalla (`pantallas/asistente`) los pinta.
 */

/**
 * Resultados que todavía se resuelven con su tarjeta de siempre (elegir, duplicados, tanda, compartido y los
 * formularios largos mientras su flujo conversacional no existe, §6): la pantalla los pinta como un turno más.
 */
export type ResultadoConTarjeta = Extract<
  ResultadoTexto,
  {
    resultado:
      | 'elegir'
      | 'duplicados'
      | 'confirmar_msi'
      | 'confirmar_division'
      | 'confirmar_compartido'
      | 'confirmar_tanda'
      | 'tarjeta_por_agregar'
      | 'tanda_por_crear';
  }
>;

export interface TurnoTarjeta {
  readonly id: string;
  readonly de: 'asistente';
  readonly clase: 'tarjeta';
  readonly datos: ResultadoConTarjeta;
  readonly origen: OrigenDictado;
}

export type TurnoConversacion = Turno | TurnoTarjeta;

// ——— Turnos derivados del día ———

/** Lo que la pantalla puede hacer desde un turno derivado. */
export interface AccionesDia {
  readonly verMovimientos: (filtro?: FiltroMovimientos) => void;
  readonly verMovimiento?: (transaccionId: string) => void;
  /** «Ya lo vi» de una observación. */
  readonly ocultarObservacion: (clave: string) => void;
  /** Arqueo (insignia de efectivo menos preciso). */
  readonly abrirArqueo?: () => void;
  /** «Ver qué viene» del aviso de riesgo: abre el desglose. */
  readonly verDesglose: () => void;
}

export interface ContextoDia {
  /** Movimientos vigentes de hoy, como los da `listarMovimientos` (del más reciente al más antiguo). */
  readonly movimientosHoy: readonly MovimientoVista[];
  /** «Lo que veo» ya calculado; se muestran dos como máximo. */
  readonly observaciones: readonly Observacion[];
  /** Probabilidad de hoy si ya está calculada y es Plus; `null` si no. */
  readonly probabilidad: VistaProbabilidadHoy | null;
  /** Tarjeta del día (Plus) o `null`. */
  readonly tarjetaDelDia: string | null;
  readonly acciones: AccionesDia;
}

export const MAX_OBSERVACIONES = 2;
export const TEXTO_EFECTIVO_MENOS_PRECISO =
  'Tu efectivo es menos preciso: hace más de una semana que no lo cuentas.';
export const BTN_CONTAR_EFECTIVO = 'Contar efectivo';
export const BTN_VER_QUE_VIENE = 'Ver qué viene';
export const BTN_YA_LO_VI = 'Ya lo vi';

/** Id del turno de un movimiento: el de la sesión que lo registró lo reemplaza (mismo id). */
export function idTurnoRegistro(transacciones: readonly string[]): string {
  return `registro:${transacciones.join(',')}`;
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «Registré Coca $25 · Antojos · Efectivo.» de un movimiento del libro. */
export function textoMovimientoDelDia(m: MovimientoVista): string {
  const nombre = nombreTipoLibro(m.tipo);
  const partes = [
    `${capitalizar(m.descripcion ?? m.comercio ?? nombre.toLowerCase())} ${formatearCentavos(m.monto)}`,
  ];
  if (m.categoria) partes.push(m.categoria);
  const cuenta = m.insignias.includes('por_asignar')
    ? 'por asignar'
    : m.sentido === 'entrada'
      ? m.llegaA[0]
      : (m.saleDe[0] ?? m.llegaA[0]);
  if (cuenta) partes.push(cuenta);
  return `Registré ${partes.join(' · ')}.`;
}

/** Frase corta de cada tarjeta de acción (la pantalla pinta la tarjeta interactiva; esto es lo que se anuncia). */
export function textoTarjetaAccion(t: TarjetaAccion): string {
  switch (t.tipo) {
    case 'pago_tarjeta':
      return t.texto;
    case 'confirmar_cobertura':
    case 'aumento_suscripcion':
    case 'liquidar_msi':
    case 'compromiso_vencido':
    case 'ingreso_no_llego':
    case 'tanda_aportacion':
    case 'tanda_cobro':
      return t.pregunta;
    case 'arqueo':
      return `En tu efectivo tengo ${formatearCentavos(t.saldo)}. ¿Cuánto traes?`;
    case 'reactivar_captura':
      return 'Vuelve a activar la lectura de notificaciones de tu banco.';
    case 'captura_inactiva':
      return 'No he visto notificaciones de tu banco en 3 días.';
    case 'pregunta_captura':
      return 'Tengo una pregunta sobre un movimiento de tu banco.';
    case 'por_interpretar':
      return t.cantidad === 1 ? 'Tienes 1 frase por revisar.' : `Tienes ${t.cantidad} frases por revisar.`;
    case 'capturas_por_revisar':
      return t.cantidad === 1
        ? 'Registré 1 movimiento de tu banco que necesita que lo revises.'
        : `Registré ${t.cantidad} movimientos de tu banco que necesitan que los revises.`;
    case 'por_asignar':
      return `Tienes ${formatearCentavos(t.monto)} en gastos sin cuenta.`;
  }
}

/** Índice de la tarjeta de acción de un turno derivado (`tarjeta-accion-<i>`), o `null`. */
export function indiceTarjetaAccion(id: string): number | null {
  const m = /^tarjeta-accion-(\d+)$/.exec(id);
  return m?.[1] !== undefined ? Number(m[1]) : null;
}

/**
 * Turnos que salen del día (§3): lo que la app tiene que decirte primero (tarjetas de acción, riesgo, efectivo,
 * «Lo que veo» y la tarjeta del día) y después un «Registré…» por cada movimiento de hoy, del más antiguo al más
 * reciente. Determinista: no lee el reloj (la fecha está en `vista.hoy` y en los movimientos).
 */
export function derivarTurnosDelDia(ctx: ContextoDia, vista: VistaHoy): Turno[] {
  const a = ctx.acciones;
  const turnos: Turno[] = [];
  vista.tarjetasAccion.forEach((t, i) => {
    turnos.push({
      id: `tarjeta-accion-${i}`,
      de: 'asistente',
      clase: 'aviso',
      texto: textoTarjetaAccion(t),
      acciones: [],
      origen: 'tarjeta_accion',
    });
  });
  const p = ctx.probabilidad;
  if (vista.estado !== 'sin_ingreso' && p?.estado === 'ok' && p.riesgo) {
    turnos.push({
      id: 'riesgo',
      de: 'asistente',
      clase: 'aviso',
      texto: TEXTO_AVISO_RIESGO_HOY,
      acciones: [{ etiqueta: BTN_VER_QUE_VIENE, accion: a.verDesglose, testID: 'aviso-riesgo-ver' }],
      origen: 'riesgo',
    });
  }
  if (vista.efectivoMenosPreciso) {
    const abrir = a.abrirArqueo;
    turnos.push({
      id: 'efectivo-menos-preciso',
      de: 'asistente',
      clase: 'aviso',
      texto: TEXTO_EFECTIVO_MENOS_PRECISO,
      acciones: abrir
        ? [{ etiqueta: BTN_CONTAR_EFECTIVO, accion: abrir, testID: 'boton-contar-efectivo' }]
        : [],
      origen: 'arqueo',
    });
  }
  ctx.observaciones.slice(0, MAX_OBSERVACIONES).forEach((o, i) => {
    const filtro = o.filtro;
    turnos.push({
      id: `observacion-${i}`,
      de: 'asistente',
      clase: 'aviso',
      texto: textoObservacion(o),
      acciones: [
        ...(filtro
          ? [
              {
                etiqueta: 'Ver movimientos',
                accion: () => a.verMovimientos(filtro),
                testID: `observacion-${i}-ver-movimientos`,
              },
            ]
          : []),
        {
          etiqueta: BTN_YA_LO_VI,
          accion: () => a.ocultarObservacion(o.clave),
          testID: `observacion-${i}-ya-lo-vi`,
        },
      ],
      origen: 'observacion',
    });
  });
  if (ctx.tarjetaDelDia) {
    turnos.push({
      id: 'tarjeta-del-dia',
      de: 'asistente',
      clase: 'aviso',
      texto: ctx.tarjetaDelDia,
      acciones: [],
      origen: 'observacion',
    });
  }
  const deHoy = ctx.movimientosHoy.filter((m) => m.fecha === vista.hoy);
  for (const m of [...deHoy].reverse()) {
    const ver = a.verMovimiento;
    turnos.push({
      id: idTurnoRegistro([m.id]),
      de: 'asistente',
      clase: 'registro',
      texto: textoMovimientoDelDia(m),
      ...(ver ? { abrir: () => ver(m.id) } : {}),
    });
  }
  return turnos;
}

// ——— Turnos de la sesión ———

export type AccionSesion =
  | { readonly tipo: 'agregar'; readonly turnos: readonly TurnoConversacion[] }
  | { readonly tipo: 'reemplazar'; readonly turno: TurnoConversacion }
  | { readonly tipo: 'resolver'; readonly id: string }
  | { readonly tipo: 'limpiar' };

/** Reductor de los turnos de la sesión: agregar (o reemplazar si el id ya está), reemplazar, resolver y limpiar. */
export function reducirSesion(
  estado: readonly TurnoConversacion[],
  accion: AccionSesion,
): readonly TurnoConversacion[] {
  switch (accion.tipo) {
    case 'agregar': {
      let siguiente = estado;
      for (const t of accion.turnos) {
        siguiente = siguiente.some((x) => x.id === t.id)
          ? siguiente.map((x) => (x.id === t.id ? t : x))
          : [...siguiente, t];
      }
      return siguiente;
    }
    case 'reemplazar':
      return estado.some((x) => x.id === accion.turno.id)
        ? estado.map((x) => (x.id === accion.turno.id ? accion.turno : x))
        : estado;
    case 'resolver':
      return estado.filter((x) => x.id !== accion.id);
    case 'limpiar':
      return [];
  }
}

/** Movimientos que ya cuenta un turno de la sesión (`registro:<id>,<id>`). */
function transaccionesDe(id: string): readonly string[] {
  return id.startsWith('registro:') ? id.slice('registro:'.length).split(',') : [];
}

/**
 * Derivados primero (sin los movimientos que ya cuenta un turno de la sesión) y la sesión al final: la
 * conversación siempre termina en lo último que pasó.
 */
export function combinarTurnos(
  derivados: readonly TurnoConversacion[],
  sesion: readonly TurnoConversacion[],
): readonly TurnoConversacion[] {
  const enSesion = new Set(sesion.map((t) => t.id));
  const cubiertas = new Set(sesion.flatMap((t) => transaccionesDe(t.id)));
  const visibles = derivados.filter(
    (t) => !enSesion.has(t.id) && !transaccionesDe(t.id).some((x) => cubiertas.has(x)),
  );
  return [...visibles, ...sesion];
}

/** La pregunta que espera respuesta: la última del asistente, si es una pregunta. */
export function preguntaAbierta(
  turnos: readonly TurnoConversacion[],
): Extract<Turno, { clase: 'pregunta' }> | null {
  for (let i = turnos.length - 1; i >= 0; i--) {
    const t = turnos[i];
    if (!t || t.de !== 'asistente') continue;
    return t.clase === 'pregunta' ? t : null;
  }
  return null;
}

function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:¿?¡!«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El chip que nombra una frase («la Nu» → «Nu ••4410»), o `null`. */
export function chipQueNombra(chips: readonly ChipRespuesta[], texto: string): ChipRespuesta | null {
  const dicho = normalizar(texto);
  if (dicho === '') return null;
  return (
    chips.find((c) => normalizar(c.etiqueta) === dicho) ??
    chips.find((c) => {
      const etiqueta = normalizar(c.etiqueta);
      return etiqueta !== '' && (dicho.includes(etiqueta) || etiqueta.includes(dicho));
    }) ??
    null
  );
}

/**
 * Lo que se dijo o escribió como respuesta a una pregunta abierta: un chip si lo nombra, una cifra si la pregunta
 * es de dinero y la frase la trae, si no el texto tal cual (el flujo decide).
 */
export function respuestaDeTexto(
  pregunta: Pick<Extract<Turno, { clase: 'pregunta' }>, 'chips' | 'campo' | 'admiteCero'>,
  texto: string,
  porVoz: boolean,
): Respuesta {
  const chip = chipQueNombra(pregunta.chips, texto);
  if (chip) return { tipo: 'chip', valor: chip.valor };
  if (pregunta.campo === 'monto') {
    // Escrita («3,200») o dicha («tres mil doscientos», «nada» si admite cero): la lee el nivel 0 en el teléfono.
    const escrita = leerPesos(texto);
    const dicha =
      escrita === null ? interpretarMonto(texto, { admiteCero: pregunta.admiteCero === true }) : null;
    const centavos = escrita ?? dicha?.centavos ?? null;
    if (centavos !== null && (centavos > 0 || pregunta.admiteCero))
      return { tipo: 'monto', centavos, aproximado: dicha?.aproximado ?? false };
  }
  return { tipo: 'texto', texto: texto.trim(), porVoz };
}

export interface Conversacion {
  readonly turnos: readonly TurnoConversacion[];
  readonly sesion: readonly TurnoConversacion[];
  readonly agregar: (...turnos: TurnoConversacion[]) => void;
  readonly reemplazar: (turno: TurnoConversacion) => void;
  /** Quita una pregunta o un «Entendí» ya contestado. */
  readonly resolver: (id: string) => void;
  readonly limpiarSesion: () => void;
  /** Id nuevo para un turno de la sesión (contador, sin reloj ni azar). */
  readonly nuevoId: (prefijo: string) => string;
}

/** Turnos derivados + turnos de la sesión (no se persisten, decisión de la Ola 7). */
export function useConversacion(derivados: readonly TurnoConversacion[]): Conversacion {
  const [sesion, despachar] = useReducer(reducirSesion, [] as readonly TurnoConversacion[]);
  const contador = useRef(0);
  const agregar = useCallback((...turnos: TurnoConversacion[]) => despachar({ tipo: 'agregar', turnos }), []);
  const reemplazar = useCallback((turno: TurnoConversacion) => despachar({ tipo: 'reemplazar', turno }), []);
  const resolver = useCallback((id: string) => despachar({ tipo: 'resolver', id }), []);
  const limpiarSesion = useCallback(() => despachar({ tipo: 'limpiar' }), []);
  const nuevoId = useCallback((prefijo: string) => {
    contador.current += 1;
    return `${prefijo}-${contador.current}`;
  }, []);
  const turnos = useMemo(() => combinarTurnos(derivados, sesion), [derivados, sesion]);
  return { turnos, sesion, agregar, reemplazar, resolver, limpiarSesion, nuevoId };
}
