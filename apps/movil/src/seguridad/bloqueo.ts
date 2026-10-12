/**
 * Cuándo pedir biometría o el PIN del sistema (RF-CFG-03, CA-M2-11). Lógica pura con reloj
 * inyectado en milisegundos (`Date.now()` en la app, un valor fijo en las pruebas).
 */

/** Tiempo en segundo plano a partir del cual se vuelve a pedir autenticación. */
export const ESPERA_BLOQUEO_MS = 60_000;

export interface EntradaBloqueo {
  /** El bloqueo está activado en Ajustes. */
  activo: boolean;
  /** Momento en que la app pasó a segundo plano; `null` si no ha salido. */
  salioEn: number | null;
  ahora: number;
  esperaMs?: number;
}

/**
 * `true` si al volver a primer plano hay que bloquear: bloqueo activado y ≥ 1 min fuera.
 * Si el reloj retrocedió (cambio de hora), bloquea: ante la duda, se protege.
 */
export function debeBloquear({
  activo,
  salioEn,
  ahora,
  esperaMs = ESPERA_BLOQUEO_MS,
}: EntradaBloqueo): boolean {
  if (!activo || salioEn === null) return false;
  const fuera = ahora - salioEn;
  return fuera < 0 || fuera >= esperaMs;
}

export type EstadoApp = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface SeguimientoBloqueo {
  bloqueado: boolean;
  salioEn: number | null;
}

/**
 * Transición por cambio de estado de la app. Solo `background` cuenta como salir: `inactive`
 * aparece en iOS al abrir el centro de control o el propio aviso de Face ID.
 */
export function transicionBloqueo(
  s: SeguimientoBloqueo,
  siguiente: EstadoApp,
  { activo, ahora, esperaMs }: { activo: boolean; ahora: number; esperaMs?: number },
): SeguimientoBloqueo {
  if (siguiente === 'background') {
    return { ...s, salioEn: s.salioEn ?? ahora };
  }
  if (siguiente === 'active') {
    const bloquear = debeBloquear({
      activo,
      salioEn: s.salioEn,
      ahora,
      ...(esperaMs === undefined ? {} : { esperaMs }),
    });
    return { bloqueado: s.bloqueado || bloquear, salioEn: null };
  }
  return s;
}
