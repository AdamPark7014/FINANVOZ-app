import { balancePareja, type BalancePareja, type EventoPareja } from '@cartera/core';
import { formaCanonica, type EventoCompartido } from './eventos';

/**
 * Fusión de E17: unión de eventos por `id`. Como los eventos solo se agregan, no hay conflictos; si dos copias del
 * mismo `id` no coinciden (no debería pasar: el `id` es aleatorio y el evento inmutable) se queda la de menor
 * forma canónica, para que el resultado no dependa del orden de llegada.
 */
export function fusionarEventos(...listas: readonly (readonly EventoCompartido[])[]): EventoCompartido[] {
  const porId = new Map<string, { evento: EventoCompartido; forma: string }>();
  for (const lista of listas) {
    for (const evento of lista) {
      const forma = formaCanonica(evento);
      const actual = porId.get(evento.id);
      if (!actual || forma < actual.forma) porId.set(evento.id, { evento, forma });
    }
  }
  return [...porId.values()]
    .sort((x, y) => (x.evento.id < y.evento.id ? -1 : x.evento.id > y.evento.id ? 1 : 0))
    .map((x) => x.evento);
}

/** Ids a los que apunta algún `evento_anulado` (aunque el anulado todavía no haya llegado). */
export function idsAnulados(eventos: readonly EventoCompartido[]): Set<string> {
  const ids = new Set<string>();
  for (const e of eventos) if (e.tipo === 'evento_anulado') ids.add(e.cuerpo.id_anulado);
  return ids;
}

/** Gastos y pagos que ningún `evento_anulado` apunta (los que cuentan para el saldo). */
export function eventosVigentes(eventos: readonly EventoCompartido[]): EventoCompartido[] {
  const unidos = fusionarEventos(eventos);
  const anulados = idsAnulados(unidos);
  return unidos.filter((e) => e.tipo !== 'evento_anulado' && !anulados.has(e.id));
}

/**
 * Entrada de E12.2 (`balancePareja`) en el formato de los vectores `E12.balance_pareja`: cada gasto o pago con
 * `anulado: true` si algún `evento_anulado` lo apunta. Los `evento_anulado` no entran.
 */
export function entradaBalance(eventos: readonly EventoCompartido[]): EventoPareja[] {
  // Primero la fusión: las anulaciones que cuentan son las de los eventos que sobreviven a ella.
  const unidos = fusionarEventos(eventos);
  const anulados = idsAnulados(unidos);
  const salida: EventoPareja[] = [];
  for (const e of unidos) {
    const anulado = anulados.has(e.id);
    if (e.tipo === 'gasto_compartido_creado') {
      salida.push({
        id: e.id,
        tipo: 'gasto',
        total: e.cuerpo.total,
        pago: e.cuerpo.pago,
        proporcionABp: e.cuerpo.proporcion_a_bp,
        anulado,
      });
    } else if (e.tipo === 'pago_compartido_creado') {
      salida.push({ id: e.id, tipo: 'pago', de: e.cuerpo.de, monto: e.cuerpo.monto, anulado });
    }
  }
  return salida;
}

/** Saldo del grupo (E12.2 sobre los eventos vigentes): `> 0` B le debe a A; `< 0` A le debe a B. */
export function saldoGrupo(eventos: readonly EventoCompartido[]): BalancePareja {
  return balancePareja(entradaBalance(eventos));
}
