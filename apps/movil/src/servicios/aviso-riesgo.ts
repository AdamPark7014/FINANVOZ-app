import { z } from 'zod';
import { redondearPorcentaje } from '@cartera/core';
import type { HoraDelDia } from '../avisos/planificar';
import { sincronizarAvisos, type PuertoNotificaciones, type ResultadoSincronizacion } from '../avisos/puerto';
import {
  planificarAvisoRiesgo,
  PREFIJO_AVISO_RIESGO,
  type AvisoRiesgo,
  type AvisoRiesgoEnviado,
} from '../avisos/riesgo';
import { obtenerPreferenciasAvisos } from './avisos-tarjetas';
import type { Contexto } from './contexto';
import { borrarAjuste, escribirAjuste, leerAjuste } from './preferencias';
import { leerProbabilidadHoy, prepararProbabilidadHoy } from './probabilidad';

const CLAVE = 'aviso_riesgo';
const Enviado = z.strictObject({ fin: z.string(), fecha: z.string(), hora: z.string() });

/**
 * Lo que debe quedar programado del aviso "Riesgo de no llegar" (`02 §13`) con la probabilidad de hoy ya
 * calculada (caché de `obtenerProbabilidadHoy`): `[]` cancela el pendiente; `null` = todavía no hay
 * probabilidad de hoy, no se toca nada. Solo con un ingreso que define horizonte (en modo ingreso variable el
 * horizonte se desliza cada día y el aviso saldría a diario).
 */
export function planAvisoRiesgo(ctx: Contexto, horaActual: HoraDelDia): AvisoRiesgo[] | null {
  const p = prepararProbabilidadHoy(ctx);
  if (p.estado !== 'listo') return [];
  const { ingreso, h } = p.calculo;
  if (!ingreso || h.estado === 'ingreso_variable') return [];
  const v = leerProbabilidadHoy(ctx);
  if (!v) return null;
  if (v.estado !== 'ok') return [];
  const pref = obtenerPreferenciasAvisos(ctx);
  const aviso = planificarAvisoRiesgo({
    hoy: v.hoy,
    horaActual,
    porcentaje: redondearPorcentaje(v.exitos, v.n),
    horizonteFin: h.fin,
    concepto: ingreso.concepto,
    activo: pref.riesgo,
    enviado: leerAjuste(ctx, CLAVE, Enviado) as AvisoRiesgoEnviado | null,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
  });
  return aviso ? [aviso] : [];
}

/**
 * Replanea el aviso de riesgo tras calcular la probabilidad de hoy y lo deja en el teléfono (idempotente).
 * Guarda cuándo sale para no repetirlo en el mismo horizonte; si se cancela antes de salir, lo olvida.
 */
export async function sincronizarAvisoRiesgo(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
): Promise<ResultadoSincronizacion | null> {
  const plan = planAvisoRiesgo(ctx, horaActual);
  if (plan === null) return null;
  const [aviso] = plan;
  if (aviso) {
    escribirAjuste(ctx, CLAVE, Enviado, { fin: aviso.referencia, fecha: aviso.fecha, hora: aviso.hora });
  } else {
    const previo = leerAjuste(ctx, CLAVE, Enviado);
    const hoy = ctx.reloj.hoy();
    const pendiente = previo && (previo.fecha > hoy || (previo.fecha === hoy && previo.hora > horaActual));
    if (pendiente) borrarAjuste(ctx, CLAVE);
  }
  return sincronizarAvisos(puerto, plan, PREFIJO_AVISO_RIESGO);
}
