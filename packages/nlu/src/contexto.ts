import type { Espacio } from './esquema';

/** Cuenta tal como viaja en el contexto del intérprete: sin id, sin saldo, sin dígitos (docs/06-NLU.md §4). */
export interface CuentaContexto {
  tipo: 'efectivo' | 'debito' | 'credito' | 'billetera';
  alias: readonly string[];
  espacio?: Espacio;
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
}
