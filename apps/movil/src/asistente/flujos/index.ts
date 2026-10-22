import type { PropuestaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, IdFlujo, PasoFlujo, Respuesta } from '../tipos';

/**
 * Formularios largos como conversación (Ola 7 §6). **Esqueleto del coordinador**: A-3 registra aquí cada flujo
 * (tarjeta, msi, tanda, cuenta_dividida, arqueo, pagar_tarjeta) y escribe `avanzar`; A-1 lo usa desde la pantalla
 * sin saber de cada flujo. El contexto (`ctx`) y el origen se pasan como `unknown` para no atar este módulo a
 * servicios; cada flujo los tipa por dentro.
 */
export interface FlujoConversacional<E> {
  readonly id: IdFlujo;
  /** Estado inicial desde lo que ya se dijo (`ResultadoTexto`, `LecturaPaso`) o `null` (chip). */
  readonly inicial: (ctx: unknown, origen: unknown) => E;
  readonly pasos: readonly PasoFlujo<E>[];
  /** «Entendí · ¿la agrego?» con `confirmar` → `guardar` y `cambiar` → `formularioLargo`. */
  readonly entendi: (ctx: unknown, e: E, acciones: AccionesFlujo) => PropuestaEntendi;
  readonly guardar: (ctx: unknown, e: E) => Promise<MensajeFlujo>;
  /** Ruta de expo-router del formulario largo prellenado («Cambiar algo»). */
  readonly formularioLargo: (e: E) => string | { pathname: string; params: Record<string, string> };
}

export interface AccionesFlujo {
  readonly guardar: () => Promise<void>;
  readonly cambiar: () => void;
}

/** Lo que el asistente dice al guardar: «Listo: agregué tu Nu.» y, si aplica, Deshacer. */
export interface MensajeFlujo {
  readonly texto: string;
  readonly cambioDia?: string;
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

export const FLUJOS: Partial<Record<IdFlujo, FlujoConversacional<unknown>>> = {};

export function siguientePregunta<E>(flujo: FlujoConversacional<E>, e: E): PreguntaFlujo | null {
  for (const p of flujo.pasos) {
    if (p.omitirSi?.(e)) continue;
    return {
      paso: p.id,
      texto: p.pregunta(e),
      ...(p.ayuda ? { ayuda: p.ayuda(e) } : {}),
      chips: p.chips?.(e) ?? [],
      ...(p.campo ? { campo: p.campo } : {}),
      ...(p.admiteCero ? { admiteCero: true } : {}),
    };
  }
  return null;
}

/** Aplica la respuesta al paso `paso`; el error se muestra en la misma pregunta. */
export function responderPaso<E>(
  flujo: FlujoConversacional<E>,
  e: E,
  paso: string,
  r: Respuesta,
): E | { readonly error: string } {
  const p = flujo.pasos.find((x) => x.id === paso);
  if (!p) return { error: 'Ese paso ya no aplica.' };
  return p.aplicar(e, r);
}
