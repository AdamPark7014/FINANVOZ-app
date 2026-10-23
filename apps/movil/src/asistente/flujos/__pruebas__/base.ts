import { expect, vi } from 'vitest';
import { aceptarConsentimiento } from '../../../privacidad/consentimiento';
import { cargarEscenario } from '../../../servicios/semilla';
import { abrirPrueba, escenario } from '../../../servicios/__pruebas__/base';
import type { PropuestaEntendi } from '../../../ui/entendi';
import type { Respuesta } from '../../tipos';
import type { FlujoConversacional, PreguntaFlujo } from '../contrato';
import { responderPaso, siguientePregunta } from '../index';

/** Base en memoria con un escenario de `fixtures/escenarios` y el reloj en su `hoy`. */
export function conEscenario(id: string) {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario(id));
  p.reloj.fijar(e.hoy);
  return { ...p, e };
}

/** Base vacía con consentimiento (para flujos que empiezan sin cuentas). */
export function baseVacia(hoy = '2026-10-11') {
  const p = abrirPrueba(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  return p;
}

export const chip = (valor: string): Respuesta => ({ tipo: 'chip', valor });
export const dicho = (texto: string): Respuesta => ({ tipo: 'texto', texto, porVoz: true });
export const monto = (centavos: number, aproximado = false): Respuesta => ({
  tipo: 'monto',
  centavos,
  aproximado,
});

/**
 * Contesta las preguntas del flujo en orden, como lo hace la pantalla (`asistente/registro.ts`): un paso ya
 * contestado no se vuelve a preguntar, así que cada pregunta debe tener su propio id. Falla si una respuesta da
 * error o si sobran respuestas. Devuelve el estado final y las preguntas que se hicieron.
 */
export function contestar<E>(
  flujo: FlujoConversacional<E>,
  inicial: E,
  respuestas: readonly Respuesta[],
): { estado: E; preguntas: PreguntaFlujo[] } {
  let e = inicial;
  const preguntas: PreguntaFlujo[] = [];
  for (const r of respuestas) {
    const respondidos = new Set(preguntas.map((q) => q.paso));
    const p = siguientePregunta({ ...flujo, pasos: flujo.pasos.filter((x) => !respondidos.has(x.id)) }, e);
    if (!p) throw new Error('sobran respuestas: ya no hay preguntas');
    // Con todos los pasos, la siguiente pregunta es la misma: ningún paso contestado queda pendiente.
    expect(siguientePregunta(flujo, e)?.paso).toBe(p.paso);
    preguntas.push(p);
    const n = responderPaso(flujo, e, p.paso, r);
    if (typeof n === 'object' && n !== null && 'error' in n)
      throw new Error(`«${p.paso}»: ${String(n.error)}`);
    e = n as E;
  }
  return { estado: e, preguntas };
}

/** La tarjeta «Entendí» con acciones espía; `actualizar` guarda el último estado que mandó una fila. */
export function entendi<E>(flujo: FlujoConversacional<E>, ctx: unknown, e: E, conActualizar = true) {
  const acciones = {
    guardar: vi.fn(async () => {}),
    cambiar: vi.fn(),
    ...(conActualizar ? { actualizar: vi.fn<(nuevo: E) => void>() } : {}),
  };
  const propuesta: PropuestaEntendi = flujo.entendi(ctx, e, acciones);
  const fila = (clave: string) => {
    const f = propuesta.filas.find((x) => x.clave === clave);
    if (!f) throw new Error(`no hay fila ${clave}: ${propuesta.filas.map((x) => x.clave).join(', ')}`);
    return f;
  };
  return { propuesta, acciones, fila };
}

/** Un paso del flujo por su id. */
export function paso<E>(flujo: FlujoConversacional<E>, id: string) {
  const p = flujo.pasos.find((x) => x.id === id);
  if (!p) throw new Error(`no hay paso ${id}`);
  return p;
}
