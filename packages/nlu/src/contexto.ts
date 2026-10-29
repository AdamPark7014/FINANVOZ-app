import type { Espacio, Interpretacion } from './esquema';

/** Cuenta tal como viaja en el contexto del intérprete: sin id, sin saldo, sin dígitos (docs/06-NLU.md §4). */
export interface CuentaContexto {
  tipo: 'efectivo' | 'debito' | 'credito' | 'billetera';
  alias: readonly string[];
  espacio?: Espacio;
}

/**
 * El turno anterior de la conversación (docs/06-NLU.md §15): lo que la persona dijo y lo que el intérprete entendió.
 * Nunca lleva lo que contestó la app (cifras de una consulta, saldos): solo lo dicho y su interpretación.
 */
export interface TurnoAnterior {
  frase: string;
  interpretacion: Interpretacion;
}

/** Contexto mínimo del intérprete (docs/06-NLU.md §4). */
export interface ContextoInterprete {
  fecha_referencia: string;
  dia_semana?: string;
  espacios: readonly Espacio[];
  cuentas: readonly CuentaContexto[];
  /** Alias de cada contacto. */
  contactos?: readonly (readonly string[])[];
  /** Alias de cada cliente del fiado (solo con negocio activo). */
  clientes?: readonly (readonly string[])[];
  ultimo_ingreso?: string;
  proximo_ingreso?: string;
  /** El turno anterior de la conversación, si lo hay (§15). */
  anterior?: TurnoAnterior;
}
