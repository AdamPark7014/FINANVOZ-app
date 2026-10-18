import type { HoraDelDia } from '../avisos/planificar';
import {
  planificarAvisosOcurrencias,
  PREFIJO_AVISO_COMPROMISO,
  PREFIJO_AVISO_INGRESO,
} from '../avisos/ocurrencias';
import {
  sincronizarAvisos,
  type NotificacionLocal,
  type PuertoNotificaciones,
  type ResultadoSincronizacion,
} from '../avisos/puerto';
import { planificarAvisosTanda, PREFIJO_AVISO_TANDA } from '../avisos/tandas';
import { obtenerPreferenciasAvisos } from './avisos-tarjetas';
import type { Contexto } from './contexto';
import { listarOcurrencias } from './ocurrencias';
import { ingresoPrincipal } from './programados';
import { detalleTanda, listarTandas, programadosDeTandas } from './tandas';

/**
 * "Aportación de tanda" (`02 §13`): un aviso por cada ronda pendiente de las tandas activas, el día de la
 * aportación. `horaActual` es la hora local del teléfono (`horaDispositivo()` en la app).
 */
export function planAvisosTanda(ctx: Contexto, horaActual: HoraDelDia): NotificacionLocal[] {
  const pref = obtenerPreferenciasAvisos(ctx);
  if (!pref.tanda) return [];
  const aportaciones = listarTandas(ctx).flatMap((t) =>
    detalleTanda(ctx, t.id)
      .rondas.filter((r) => r.estado === 'pendiente')
      .map((r) => ({ tandaId: t.id, fecha: r.fecha })),
  );
  return planificarAvisosTanda({
    hoy: ctx.reloj.hoy(),
    horaActual,
    aportaciones,
    activo: pref.tanda,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
  });
}

/**
 * "Compromiso sin cubrir" e "Ingreso que no llegó" (`02 §13`) con el mismo criterio que las tarjetas de acción de
 * Hoy: egresos pendientes que no son aportaciones de tanda, y las ocurrencias del ingreso que define el horizonte.
 */
export function planAvisosOcurrencias(ctx: Contexto, horaActual: HoraDelDia): NotificacionLocal[] {
  const pref = obtenerPreferenciasAvisos(ctx);
  if (!pref.compromiso && !pref.ingreso) return [];
  const pendientes = listarOcurrencias(ctx, { estado: 'pendiente' });
  const deTandas = programadosDeTandas(ctx);
  const ingresoId = ingresoPrincipal(ctx)?.id ?? null;
  const ref = (o: { programadoId: string; fecha: string }) => ({
    programadoId: o.programadoId,
    fecha: o.fecha,
  });
  return planificarAvisosOcurrencias({
    hoy: ctx.reloj.hoy(),
    horaActual,
    compromisos: pendientes.filter((o) => o.tipo === 'egreso' && !deTandas.has(o.programadoId)).map(ref),
    ingresos: pendientes.filter((o) => o.tipo === 'ingreso' && o.programadoId === ingresoId).map(ref),
    avisarCompromiso: pref.compromiso,
    avisarIngreso: pref.ingreso,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
  });
}

/**
 * Al abrir la app y después de cada escritura: deja en el teléfono exactamente los avisos de tandas, compromisos
 * e ingresos (idempotente; los de ocurrencias ya resueltas se cancelan).
 */
export async function sincronizarAvisosOcurrencias(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
): Promise<ResultadoSincronizacion> {
  const ocurrencias = planAvisosOcurrencias(ctx, horaActual);
  const partes = [
    await sincronizarAvisos(puerto, planAvisosTanda(ctx, horaActual), PREFIJO_AVISO_TANDA),
    await sincronizarAvisos(
      puerto,
      ocurrencias.filter((a) => a.id.startsWith(PREFIJO_AVISO_COMPROMISO)),
      PREFIJO_AVISO_COMPROMISO,
    ),
    await sincronizarAvisos(
      puerto,
      ocurrencias.filter((a) => a.id.startsWith(PREFIJO_AVISO_INGRESO)),
      PREFIJO_AVISO_INGRESO,
    ),
  ];
  return {
    programadas: partes.flatMap((p) => p.programadas),
    canceladas: partes.flatMap((p) => p.canceladas),
    sinCambio: partes.flatMap((p) => p.sinCambio),
  };
}
