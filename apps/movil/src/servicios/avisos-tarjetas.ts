import { z } from 'zod';
import { ErrorDominio, type Centavos } from '@cartera/core';
import {
  HORA_AVISOS_POR_OMISION,
  HORARIO_SILENCIOSO_POR_OMISION,
  planificarAvisosTarjetas,
  PREFIJO_AVISOS_TARJETA,
  type AvisoPlaneado,
  type HoraDelDia,
  type HorarioSilencioso,
} from '../avisos/planificar';
import { sincronizarAvisos, type PuertoNotificaciones, type ResultadoSincronizacion } from '../avisos/puerto';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import type { Contexto } from './contexto';
import { estadosDeCuenta } from './cortes';
import { escribirAjuste, leerAjuste } from './preferencias';
import { tarjetasActivas } from './tarjetas';

const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const PreferenciasAvisos = z.strictObject({
  silencio: z.strictObject({ inicio: Hora, fin: Hora }),
  hora: Hora,
  corte: z.boolean(),
  fecha_limite: z.boolean(),
});

export interface PreferenciasAvisos {
  readonly silencio: HorarioSilencioso;
  /** Hora a la que salen los avisos del día. */
  readonly hora: HoraDelDia;
  /** "Día de corte" (`02 §13`, encendido por defecto). */
  readonly corte: boolean;
  /** "Fecha límite de pago" 3 días antes con el PNGI (encendido por defecto). */
  readonly fechaLimite: boolean;
}

const CLAVE = 'avisos_tarjetas';

export function obtenerPreferenciasAvisos(ctx: Contexto): PreferenciasAvisos {
  const g = leerAjuste(ctx, CLAVE, PreferenciasAvisos);
  return g
    ? { silencio: g.silencio, hora: g.hora, corte: g.corte, fechaLimite: g.fecha_limite }
    : {
        silencio: HORARIO_SILENCIOSO_POR_OMISION,
        hora: HORA_AVISOS_POR_OMISION,
        corte: true,
        fechaLimite: true,
      };
}

/** Ajustes → Avisos: horario silencioso (22:00–08:00 por omisión), hora y qué avisos de tarjeta salen. */
export function fijarPreferenciasAvisos(
  ctx: Contexto,
  cambios: Partial<PreferenciasAvisos>,
): PreferenciasAvisos {
  exigirConsentimiento(ctx);
  const nuevas = { ...obtenerPreferenciasAvisos(ctx), ...cambios };
  const r = PreferenciasAvisos.safeParse({
    silencio: nuevas.silencio,
    hora: nuevas.hora,
    corte: nuevas.corte,
    fecha_limite: nuevas.fechaLimite,
  });
  if (!r.success) throw new ErrorDominio('avisos_invalidos', 'revisa el horario de los avisos');
  escribirAjuste(ctx, CLAVE, PreferenciasAvisos, r.data);
  return nuevas;
}

/**
 * Avisos de corte y fecha límite de todas las tarjetas activas (CA-M4-04): el PNGI sale de los estados de cuenta
 * ya cerrados (E5.3). `horaActual` es la hora local del teléfono (`horaDispositivo()` en la app).
 */
export function planAvisosTarjetas(ctx: Contexto, horaActual: HoraDelDia): AvisoPlaneado[] {
  const pref = obtenerPreferenciasAvisos(ctx);
  return planificarAvisosTarjetas({
    hoy: ctx.reloj.hoy(),
    horaActual,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
    avisarCorte: pref.corte,
    avisarLimite: pref.fechaLimite,
    tarjetas: tarjetasActivas(ctx).map((t) => {
      const pngiPorCorte: Record<string, Centavos> = {};
      for (const ec of estadosDeCuenta(ctx, t.cuentaId)) pngiPorCorte[ec.corte] = ec.pngi;
      return { id: t.cuentaId, nombre: t.nombre, ciclo: t.ciclo, pngiPorCorte };
    }),
  });
}

/**
 * Al abrir la app, después de cerrar cortes y cada vez que cambia una tarjeta o un pago: replanea y sincroniza
 * con el puerto de notificaciones (1 por tarjeta y periodo; los que cambian se reprograman).
 */
export function sincronizarAvisosTarjetas(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
): Promise<ResultadoSincronizacion> {
  return sincronizarAvisos(puerto, planAvisosTarjetas(ctx, horaActual), PREFIJO_AVISOS_TARJETA);
}
