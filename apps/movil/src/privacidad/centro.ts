import { sql } from 'drizzle-orm';
import type { Contexto } from '../servicios/contexto';
import { obtenerEstadoCaptura } from '../servicios/estado-captura';
import { obtenerConsentimiento } from './consentimiento';
import { estadisticasActivas } from './estadisticas';

/** Lo que muestra el centro de privacidad (RF-PRI-03, `02 §12`, `08 §2`). Solo conteos, nunca contenido. */
export interface VistaCentroPrivacidad {
  /** Versión del aviso aceptada y fecha civil; `null` antes de O2. */
  readonly consentimiento: { readonly version: string; readonly fecha: string } | null;
  /** Finalidad secundaria: estadísticas anónimas de uso (opt-in). */
  readonly estadisticas: boolean;
  readonly captura: { readonly activada: boolean; readonly apps: number };
  /** Qué hay guardado en este teléfono. */
  readonly guardado: {
    readonly cuentas: number;
    readonly tarjetas: number;
    readonly movimientos: number;
    readonly personas: number;
    /** Textos de notificaciones bancarias guardados (≤ 30 días, `04 §6`). */
    readonly textosNotificacion: number;
    readonly frasesPorInterpretar: number;
  };
}

function contar(ctx: Contexto, consulta: ReturnType<typeof sql>): number {
  return Number(ctx.db.get<{ n: number }>(consulta)?.n ?? 0);
}

export function obtenerCentroPrivacidad(ctx: Contexto): VistaCentroPrivacidad {
  const c = obtenerConsentimiento(ctx);
  const captura = obtenerEstadoCaptura(ctx);
  return {
    consentimiento: c ? { version: c.version, fecha: c.fecha } : null,
    estadisticas: estadisticasActivas(ctx),
    captura: { activada: captura.activada, apps: captura.apps.length },
    guardado: {
      cuentas: contar(
        ctx,
        sql`SELECT count(*) AS n FROM cuenta WHERE sistema = 0 AND archivada = 0 AND naturaleza IN ('activo', 'pasivo')`,
      ),
      tarjetas: contar(ctx, sql`SELECT count(*) AS n FROM tarjeta`),
      movimientos: contar(ctx, sql`SELECT count(*) AS n FROM transaccion_vigente`),
      personas: contar(ctx, sql`SELECT count(*) AS n FROM contacto`),
      textosNotificacion: contar(ctx, sql`SELECT count(*) AS n FROM captura WHERE texto_crudo IS NOT NULL`),
      frasesPorInterpretar: contar(
        ctx,
        sql`SELECT count(*) AS n FROM ajuste WHERE substr(clave, 1, 16) = 'por_interpretar:'`,
      ),
    },
  };
}
