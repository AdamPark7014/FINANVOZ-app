import type { PrellenadoR2 } from '../../asistente/registro';
import type { ResultadoTexto } from '../../servicios';
import type { MovimientoGuardado } from '../principal/FormularioMovimiento';

/**
 * Lo que vuelve al asistente desde `/registrar`: un movimiento del formulario corto, el resultado de un formulario
 * largo de un flujo (compra a meses, cuenta dividida) o solo un mensaje (tanda guardada).
 */
export type GuardadoR2 =
  | { readonly tipo: 'movimiento'; readonly movimiento: MovimientoGuardado }
  | { readonly tipo: 'resultado'; readonly resultado: ResultadoTexto }
  | { readonly tipo: 'mensaje'; readonly mensaje: string };

/**
 * R2 (formulario corto, modal `/registrar`): lo dicho viaja en memoria, nunca en la ruta (regla 9: montos,
 * comercios y lo oído no van a la URL ni a las migas de navegación). Lo que R2 guarda vuelve al asistente por
 * aquí: la pantalla lo recoge y muestra el turno «Registré…» con Deshacer.
 */

let pendiente: PrellenadoR2 | null = null;
let guardados: GuardadoR2[] = [];
const oyentes = new Set<() => void>();

/** Abre R2 con lo dicho (o vacío). */
export function abrirR2(router: { push: (ruta: '/registrar') => void }, prellenado?: PrellenadoR2): void {
  pendiente = prellenado ?? null;
  router.push('/registrar');
}

/** R2 lee lo dicho una sola vez al montarse. */
export function tomarPrellenadoR2(): PrellenadoR2 | null {
  const p = pendiente;
  pendiente = null;
  return p;
}

/** R2 avisa que guardó; el asistente lo muestra como turno. */
export function avisarGuardadoR2(g: MovimientoGuardado): void {
  avisarDesdeRegistrar({ tipo: 'movimiento', movimiento: g });
}

/** Cualquier pantalla de `/registrar` (R2 o un formulario largo) avisa lo guardado. */
export function avisarDesdeRegistrar(g: GuardadoR2): void {
  guardados = [...guardados, g];
  for (const o of oyentes) o();
}

/** El asistente recoge lo que R2 guardó (y lo quita de la cola). */
export function tomarGuardadosR2(): readonly GuardadoR2[] {
  const g = guardados;
  guardados = [];
  return g;
}

export function suscribirGuardadosR2(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Lo que llega al asistente desde fuera por `/registrar?…` (enlaces de antes): el micrófono del widget
 * (`dictar=1`) o «Revisar» una frase de «Por revisar» (`frase=<id>`, solo el id). La ruta lo deja aquí y abre la
 * pestaña; el asistente lo atiende al recibirlo.
 */
export type PedidoAsistente =
  { readonly tipo: 'dictar' } | { readonly tipo: 'revisar'; readonly frase: string };

let pedido: PedidoAsistente | null = null;
const oyentesPedido = new Set<() => void>();

export function pedirAlAsistente(p: PedidoAsistente): void {
  pedido = p;
  for (const o of oyentesPedido) o();
}

export function tomarPedidoAsistente(): PedidoAsistente | null {
  const p = pedido;
  pedido = null;
  return p;
}

export function suscribirPedidosAsistente(oyente: () => void): () => void {
  oyentesPedido.add(oyente);
  return () => {
    oyentesPedido.delete(oyente);
  };
}

/** Solo pruebas. */
export function reiniciarR2(): void {
  pendiente = null;
  guardados = [];
  pedido = null;
}
