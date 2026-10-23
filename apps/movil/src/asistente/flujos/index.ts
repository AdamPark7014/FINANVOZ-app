import type { IdFlujo, Respuesta } from '../tipos';
import { flujoArqueo } from './arqueo';
import type { FlujoConversacional, PreguntaFlujo } from './contrato';
import { flujoCuentaDividida } from './cuenta-dividida';
import { flujoMsi } from './msi';
import { flujoPagarTarjeta } from './pagar-tarjeta';
import { flujoTanda } from './tanda';
import { flujoTarjeta } from './tarjeta';
import { ERROR_PASO } from './textos';

/**
 * Formularios largos como conversación (Ola 7 §6): tarjeta, compra a meses, tanda, cuenta dividida, arqueo y pagar
 * tarjeta. La pantalla (A-1) los usa sin saber de cada uno:
 *
 * 1. `iniciarFlujo(id, ctx, origen)` (o `flujoDeResultado(r)` para saber cuál abre un `ResultadoTexto`).
 * 2. Mientras `siguientePregunta(flujo, e)` no sea `null`: turno `pregunta` con sus chips y campo; la respuesta pasa
 *    por `responderPaso` (estado nuevo o `{ error }` que se muestra en la misma pregunta).
 * 3. `flujo.entendi(ctx, e, { guardar, cambiar, actualizar })` → turno `entendi`. «Sí» → `flujo.guardar(ctx, e)` →
 *    turno `registro` con `MensajeFlujo`; «Cambiar algo» → `router.push(flujo.formularioLargo(e))`.
 */
export type {
  AccionesFlujo,
  FlujoConversacional,
  MensajeFlujo,
  OrigenFlujo,
  PreguntaFlujo,
} from './contrato';
export { tomarPrellenado, type PrellenadosFlujo, type PrellenadoTarjeta } from './prellenado';
export type { EstadoArqueo } from './arqueo';
export type { EstadoDivision } from './cuenta-dividida';
export type { EstadoMsi } from './msi';
export type { EstadoPagoTarjeta } from './pagar-tarjeta';
export type { EstadoTanda } from './tanda';
export type { EstadoTarjeta } from './tarjeta';

/** Cada flujo guarda su propio estado; el registro lo borra a `unknown` para que la pantalla no sepa de cada uno. */
function registrar<E>(flujo: FlujoConversacional<E>): FlujoConversacional<unknown> {
  return flujo as unknown as FlujoConversacional<unknown>;
}

export const FLUJOS: Readonly<Record<IdFlujo, FlujoConversacional<unknown>>> = {
  tarjeta: registrar(flujoTarjeta),
  msi: registrar(flujoMsi),
  tanda: registrar(flujoTanda),
  cuenta_dividida: registrar(flujoCuentaDividida),
  arqueo: registrar(flujoArqueo),
  pagar_tarjeta: registrar(flujoPagarTarjeta),
};

/** Resultados de `registrarTexto` que se contestan con un flujo en vez de un formulario. */
const POR_RESULTADO: Readonly<Record<string, IdFlujo>> = {
  tarjeta_por_agregar: 'tarjeta',
  confirmar_msi: 'msi',
  tanda_por_crear: 'tanda',
  confirmar_division: 'cuenta_dividida',
  arqueo: 'arqueo',
};

/** Qué flujo abre un `ResultadoTexto` («traigo 300» → arqueo), o `null` si no abre ninguno. */
export function flujoDeResultado(r: { readonly resultado: string } | null): IdFlujo | null {
  return r ? (POR_RESULTADO[r.resultado] ?? null) : null;
}

export type FlujoIniciado =
  | { readonly flujo: FlujoConversacional<unknown>; readonly estado: unknown }
  | { readonly noDisponible: string };

/**
 * Arranca un flujo con lo que ya se dijo (`OrigenFlujo`). Si no se puede (sin efectivo, sin tarjetas), devuelve el
 * porqué para decirlo como turno de texto.
 */
export function iniciarFlujo(id: IdFlujo, ctx: unknown, origen: unknown = null): FlujoIniciado {
  const flujo = FLUJOS[id];
  const motivo = flujo.noDisponible?.(ctx) ?? null;
  if (motivo !== null) return { noDisponible: motivo };
  return { flujo, estado: flujo.inicial(ctx, origen) };
}

export function siguientePregunta<E>(flujo: FlujoConversacional<E>, e: E): PreguntaFlujo | null {
  for (const p of flujo.pasos) {
    if (p.omitirSi?.(e)) continue;
    const ayuda = p.ayuda?.(e);
    return {
      paso: p.id,
      texto: p.pregunta(e),
      ...(ayuda ? { ayuda } : {}),
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
  if (!p) return { error: ERROR_PASO };
  return p.aplicar(e, r);
}
