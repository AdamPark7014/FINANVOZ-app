import { type Centavos, type PuntosBase, exigirCentavos } from '../dinero';
import { ErrorDominio } from '../errores';

/** Fila de la tarifa anual del ISR (art. 152 LISR), en centavos y puntos base; filas en orden ascendente. */
export interface FilaTarifa {
  limite_inferior: Centavos;
  cuota_fija: Centavos;
  tasa_bp: PuntosBase;
}

export interface ResultadoAhorro {
  isr_sin_deducciones: Centavos;
  isr_con_deducciones: Centavos;
  ahorro_estimado: Centavos;
}

/** Revisa la forma de la tarifa: primera fila desde 0, límites estrictamente crecientes, montos y tasas enteros. */
export function validarTarifa(tarifa: readonly FilaTarifa[]): void {
  const invalida = (motivo: string) => new ErrorDominio('tarifa_invalida', motivo);
  if (tarifa.length === 0) throw invalida('la tarifa no tiene filas');
  tarifa.forEach((f, i) => {
    const enteros = [f.limite_inferior, f.cuota_fija, f.tasa_bp].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    );
    if (!enteros || f.tasa_bp > 10000) throw invalida(`fila ${i} con valores fuera de rango`);
    if (i === 0 && f.limite_inferior !== 0) throw invalida('la primera fila debe empezar en 0');
    const anterior = tarifa[i - 1];
    if (anterior && f.limite_inferior <= anterior.limite_inferior) throw invalida('límites no crecientes');
  });
}

/** `redondear(n / d)` de `05 §Convenciones`: entero más cercano, .5 hacia arriba (n ≥ 0, d > 0). */
function redondear(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

/**
 * E13.3 · ISR anual por tarifa: fila con el mayor `limite_inferior ≤ base`;
 * `cuota_fija + redondear((base − limite_inferior)·tasa_bp / 10000)`. Base ≤ 0 → 0.
 */
export function isrPorTarifa(base: Centavos, tarifa: readonly FilaTarifa[]): Centavos {
  validarTarifa(tarifa);
  exigirCentavos(base, 'base', { minimo: Number.MIN_SAFE_INTEGER });
  if (base <= 0) return 0;
  let fila = tarifa[0] as FilaTarifa;
  for (const f of tarifa) if (f.limite_inferior <= base) fila = f;
  const excedente = BigInt(base - fila.limite_inferior) * BigInt(fila.tasa_bp);
  return fila.cuota_fija + Number(redondear(excedente, 10000n));
}

/** E13.3 · `ahorro = isr(base) − isr(max(0, base − deducciones))`. Es una estimación, no una declaración. */
export function ahorroPorDeducciones(
  base_gravable: Centavos,
  deducciones: Centavos,
  tarifa: readonly FilaTarifa[],
): ResultadoAhorro {
  exigirCentavos(base_gravable, 'base_gravable');
  exigirCentavos(deducciones, 'deducciones');
  const sin = isrPorTarifa(base_gravable, tarifa);
  const con = isrPorTarifa(Math.max(0, base_gravable - deducciones), tarifa);
  return { isr_sin_deducciones: sin, isr_con_deducciones: con, ahorro_estimado: sin - con };
}
