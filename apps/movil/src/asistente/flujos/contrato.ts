import type { PropuestaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, IdFlujo, PasoFlujo } from '../tipos';

/**
 * Contrato de los formularios largos como conversación (Ola 7 §6). La pantalla (A-1) no sabe de cada flujo: arranca
 * uno con `inicial`, pregunta con `siguientePregunta`/`responderPaso` hasta que no falte nada, pinta `entendi` y, con
 * «Sí», llama `guardar`; «Cambiar algo» abre `formularioLargo`. El contexto (`ctx`, un `Contexto` de servicios) y el
 * origen se pasan como `unknown` para no atar este módulo a servicios; cada flujo los tipa por dentro.
 */
export interface FlujoConversacional<E> {
  readonly id: IdFlujo;
  /**
   * Estado inicial desde lo que ya se dijo (ver `OrigenFlujo`). Puede leer la base (cuentas, tarjetas, efectivo):
   * todo lo que necesitan los pasos queda en el estado, porque `pregunta` y `aplicar` no reciben `ctx`.
   */
  readonly inicial: (ctx: unknown, origen: unknown) => E;
  readonly pasos: readonly PasoFlujo<E>[];
  /** «Entendí · ¿la agrego?» con `confirmar` → `acciones.guardar` y `cambiar` → `acciones.cambiar`. */
  readonly entendi: (ctx: unknown, e: E, acciones: AccionesFlujo<E>) => PropuestaEntendi;
  /** Escribe con el servicio de siempre (toda escritura pasa por `Libro.registrar`). Rechaza con `ErrorDominio`. */
  readonly guardar: (ctx: unknown, e: E) => Promise<MensajeFlujo>;
  /**
   * Ruta de expo-router del formulario largo («Cambiar algo»). Lo dicho no viaja en la ruta (regla 9): se deja en
   * memoria y la pantalla del formulario lo toma con `tomarPrellenado(id)`.
   */
  readonly formularioLargo: (e: E) => string | { pathname: string; params: Record<string, string> };
  /**
   * Por qué no se puede empezar (sin efectivo, sin tarjetas, sin cuentas), o `null` si sí. La pantalla lo dice como
   * turno de texto en vez de arrancar el flujo.
   */
  readonly noDisponible?: (ctx: unknown) => string | null;
}

export interface AccionesFlujo<E = unknown> {
  readonly guardar: () => Promise<void>;
  readonly cambiar: () => void;
  /**
   * Una fila de «Entendí» con opciones cambió el estado. La pantalla guarda `nuevo`, vuelve a llamar
   * `siguientePregunta` (si el cambio abrió un hueco, primero pregunta) y pinta otra vez «Entendí». Sin esta acción
   * las filas no muestran opciones.
   */
  readonly actualizar?: (nuevo: E) => void;
}

/** Lo que el asistente dice al guardar: «Listo: agregué tu Nu.» y, si aplica, Deshacer. */
export interface MensajeFlujo {
  readonly texto: string;
  /** Segunda línea del turno («Cobras $5,000 el jue 26 nov.»). */
  readonly detalle?: string;
  /** «Tu día pasa de $214 a $187.» si la cifra de Hoy cambió. */
  readonly cambioDia?: string;
  /** Token para `deshacer(ctx, token)` (servicios/deshacer). */
  readonly deshacer?: string;
}

/** Siguiente paso a preguntar, o `null` si ya está todo para la tarjeta «Entendí». */
export interface PreguntaFlujo {
  readonly paso: string;
  readonly texto: string;
  readonly ayuda?: string;
  readonly chips: readonly ChipRespuesta[];
  readonly campo?: 'monto' | 'texto' | 'fecha';
  readonly admiteCero?: boolean;
}

/**
 * Lo que ya se dijo, como lo recibe `inicial`:
 * - un `ResultadoTexto` de `registrarTexto` (`tarjeta_por_agregar`, `confirmar_msi`, `tanda_por_crear`,
 *   `confirmar_division`, `arqueo`);
 * - una `LecturaPaso` de `interpretarPaso('tarjeta' | 'tanda', frase)`;
 * - la frase tal cual (`string`), que el flujo interpreta con `interpretarPaso`;
 * - `{ tarjetaId }` (pagar una tarjeta desde su aviso) o `{ cuentaId }` (contar un efectivo concreto);
 * - `null` (el chip «Agregar tarjeta», «Contar efectivo», «Pagar tarjeta»).
 * Si vino por voz, envuélvelo: `{ desde, porVoz: true }` (los movimientos quedan con origen `voz`).
 */
export interface OrigenFlujo {
  readonly desde: unknown;
  readonly porVoz?: boolean;
}
