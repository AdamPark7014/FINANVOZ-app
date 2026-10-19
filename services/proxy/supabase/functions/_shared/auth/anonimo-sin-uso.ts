// Criterios conservadores para borrar usuarios anónimos huérfanos (pendiente 57, docs/ESTADO.md).
// La consulta en producción está en `migrations/20261301000000_anonimos_sin_uso.sql`; esta función
// es la especificación probada en Vitest (debe coincidir con la migración).

export type PlanDerecho = 'gratis' | 'plus' | 'negocio';

export type PerfilAnonimo = {
  readonly esAnonimo: boolean;
  /** Correo confirmado = cuenta de respaldo vinculada (M9). */
  readonly correoConfirmado: boolean;
  readonly tieneObjetosRespaldo: boolean;
  readonly plan: PlanDerecho | null;
  /** ISO o Date; null = sin vencimiento. */
  readonly vigenteHasta: Date | string | null;
  readonly enGrupoCompartidoActivo: boolean;
  /** Último acceso Auth o alta si nunca entró. */
  readonly ultimaActividad: Date | string;
};

export function plusNegocioVigente(
  plan: PlanDerecho | null,
  vigenteHasta: Date | string | null,
  ahora: Date,
): boolean {
  if (plan !== 'plus' && plan !== 'negocio') return false;
  if (vigenteHasta === null) return true;
  const v = vigenteHasta instanceof Date ? vigenteHasta : new Date(vigenteHasta);
  return !Number.isNaN(v.getTime()) && v.getTime() > ahora.getTime();
}

export type ResultadoCandidato =
  { readonly candidato: true } | { readonly candidato: false; readonly motivo: string };

/** `inactivoAntesDe`: instante límite; la actividad debe ser estrictamente anterior. */
export function evaluarCandidatoAnonimo(
  perfil: PerfilAnonimo,
  inactivoAntesDe: Date,
  ahora: Date = new Date(),
): ResultadoCandidato {
  if (!perfil.esAnonimo) return { candidato: false, motivo: 'no_anonimo' };
  if (perfil.correoConfirmado) return { candidato: false, motivo: 'correo_respaldo' };
  if (perfil.tieneObjetosRespaldo) return { candidato: false, motivo: 'respaldo_nube' };
  if (plusNegocioVigente(perfil.plan, perfil.vigenteHasta, ahora)) {
    return { candidato: false, motivo: 'plus_vigente' };
  }
  if (perfil.enGrupoCompartidoActivo) return { candidato: false, motivo: 'grupo_compartido' };

  const u =
    perfil.ultimaActividad instanceof Date ? perfil.ultimaActividad : new Date(perfil.ultimaActividad);
  if (Number.isNaN(u.getTime())) return { candidato: false, motivo: 'actividad_invalida' };
  if (u.getTime() >= inactivoAntesDe.getTime()) return { candidato: false, motivo: 'activo_reciente' };

  return { candidato: true };
}

export function umbralInactividad(dias: number, ahora: Date = new Date()): Date {
  if (!Number.isFinite(dias) || dias < 1) throw new Error('dias_invalido');
  return new Date(ahora.getTime() - dias * 86_400_000);
}
