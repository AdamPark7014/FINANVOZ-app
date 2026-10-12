import {
  crearSimulacion,
  ErrorDominio,
  type EntradaSimulacion,
  type Paso,
  type ResultadoSimulacion,
} from '@cartera/core';

/** Trayectorias por bloque entre cesiones del hilo (`03 §5.3`: p. ej. 1 000 por tick). */
export const TAMANO_BLOQUE = 1000;

/** Compatible con `AbortSignal`: la pantalla cancela si la persona se va. */
export interface SenalCancelacion {
  readonly aborted: boolean;
}

export interface OpcionesBloques {
  /** Trayectorias por bloque (por omisión 1 000). */
  readonly tamanoBloque?: number;
  /** Se llama después de cada bloque con lo hecho y el total (para el indicador de progreso). */
  readonly alProgreso?: (hechas: number, total: number) => void;
  /** Al cancelarse, la promesa se rechaza con `ErrorDominio('calculo_cancelado')`. */
  readonly senal?: SenalCancelacion;
  /** Cede el hilo entre bloques; por omisión `setTimeout(0)`. Inyectable en pruebas. */
  readonly ceder?: () => Promise<void>;
}

const cederConTimeout = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

/**
 * Corre un cálculo de `core` por bloques, cediendo el hilo entre ellos para que la UI no se congele
 * (CA-M6-02). El orden de llamadas al PRNG no cambia: el resultado es idéntico al de una sola vez.
 */
export async function ejecutarPorBloques<T>(paso: Paso<T>, opciones: OpcionesBloques = {}): Promise<T> {
  const bloque = opciones.tamanoBloque ?? TAMANO_BLOQUE;
  if (!Number.isSafeInteger(bloque) || bloque < 1) {
    throw new ErrorDominio('parametro_invalido', 'tamanoBloque debe ser un entero ≥ 1');
  }
  const ceder = opciones.ceder ?? cederConTimeout;
  for (;;) {
    if (opciones.senal?.aborted) throw new ErrorDominio('calculo_cancelado', 'se canceló el cálculo');
    const terminado = paso.avanzar(bloque);
    opciones.alProgreso?.(paso.hechas(), paso.total);
    if (terminado) return paso.resultado();
    await ceder();
  }
}

/** E8 por bloques (`03 §5.3`): Hoy usa K = 1 y N = 10 000. */
export function simularPorBloques(
  entrada: EntradaSimulacion,
  opciones: OpcionesBloques = {},
): Promise<ResultadoSimulacion> {
  return ejecutarPorBloques(crearSimulacion(entrada), opciones);
}
