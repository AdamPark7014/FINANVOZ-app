import type { Centavos } from '@cartera/core';

/**
 * Tarjeta «Entendí» (Ola 7, `docs/diseno/OLA-7-ASISTENTE.md` §3): lo que el asistente entendió, fila por fila, con
 * «Sí» y «Cambiar». La usan el asistente, el onboarding por voz, el arqueo y los flujos conversacionales. `ui/` no
 * sabe de servicios: quien arma la propuesta pone los textos ya formateados y las acciones.
 */
export interface OpcionFilaEntendi {
  readonly valor: string;
  readonly etiqueta: string;
}

export interface FilaEntendi {
  /** 'monto' | 'que' | 'cuenta' | 'categoria' | 'cuando' | …; da el testID `entendi-fila-<clave>`. */
  readonly clave: string;
  /** «Cuenta». */
  readonly etiqueta: string;
  /** «BBVA débito». */
  readonly valor: string;
  /** Si hay opciones, tocar la fila las muestra como chips y elegir una llama `alCambiar`. */
  readonly opciones?: readonly OpcionFilaEntendi[];
  readonly alCambiar?: (valor: string) => void;
}

export interface AccionEntendi {
  /** «Sí, regístralo» · «Sí, agrégala» · «Cambiar algo». */
  readonly etiqueta: string;
  readonly accion: () => void | Promise<void>;
  /**
   * Todavía falta algo para poder hacerlo (p. ej. elegir la cuenta): el botón se ve y se anuncia inactivo, la
   * tarjeta dice por qué y un «sí» dicho no lo dispara. Solo tiene efecto en `confirmar`.
   */
  readonly deshabilitado?: boolean;
  /** Por qué no se puede todavía, visible bajo el botón: «Elige la cuenta para registrarlo». */
  readonly motivoDeshabilitado?: string;
}

export interface PropuestaEntendi {
  /** «Entendí» · «Entendí · ¿la agrego?» · «Entendí · ¿lo guardo?». */
  readonly titulo: string;
  /** Cifra grande arriba de las filas (opcional). */
  readonly monto?: Centavos;
  readonly filas: readonly FilaEntendi[];
  /** Qué pasa con tu día: «La luz ya estaba apartada: tu día sigue en $214.» */
  readonly efecto?: string;
  readonly confirmar: AccionEntendi;
  /** Abre R2 o el formulario largo prellenado. */
  readonly cambiar?: AccionEntendi;
  /** «También puedes decir “sí” o “no, fue con la Nu”.» */
  readonly pista?: string;
}
