import type { Contexto } from '../contexto';
import { registrarMovimiento } from '../formulario';

/** Un gasto de un vector E14 (`fixtures/motores/vectores.json`, se carga por id). */
export interface GastoVectorE14 {
  readonly fecha: string;
  readonly monto: number;
  readonly comercio: string;
}

/**
 * Libro equivalente a un vector E14: cada gasto del vector registrado con su comercio desde `origenId`
 * (categoría `suscripciones`, salvo OXXO en `antojos`). Sin `import.meta`: también lo usa jest.
 */
export function registrarGastosE14(ctx: Contexto, gastos: readonly GastoVectorE14[], origenId: string): void {
  for (const g of gastos) {
    registrarMovimiento(ctx, {
      tipo: 'gasto',
      fecha: g.fecha,
      monto: g.monto,
      comercio: g.comercio,
      categoria: g.comercio.startsWith('OXXO') ? 'antojos' : 'suscripciones',
      origenId,
    });
  }
}
