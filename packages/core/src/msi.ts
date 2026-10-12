import { exigirCentavos, type Centavos } from './dinero';
import { ErrorDominio } from './errores';
import { sumarDias, type PlainDate } from './fecha';
import { distribuirMayorResiduo } from './reparto';
import { corteDe, limiteDe, siguienteCorte, type TarjetaCredito } from './tarjetas';

/** Una cuota de un plan MSI: se factura en `corte` y vence en `limite`. */
export interface CuotaMsi {
  readonly n: number;
  readonly monto: Centavos;
  readonly corte: PlainDate;
  readonly limite: PlainDate;
}

export interface PlanMsiExistente {
  /** Lo que falta por pagar: `mensualidad × restantes`. */
  readonly saldoMsi: Centavos;
  readonly cuotas: readonly CuotaMsi[];
}

function exigirEntero(valor: number, campo: string, minimo: number): number {
  if (!Number.isSafeInteger(valor) || valor < minimo) {
    throw new ErrorDominio('plan_msi_invalido', `${campo} debe ser un entero ≥ ${minimo}`);
  }
  return valor;
}

function cuotasDesde(
  tarjeta: TarjetaCredito,
  primerCorte: PlainDate,
  montos: readonly Centavos[],
): CuotaMsi[] {
  const cuotas: CuotaMsi[] = [];
  let corte = primerCorte;
  montos.forEach((monto, i) => {
    cuotas.push({ n: i + 1, monto, corte, limite: limiteDe(tarjeta, corte) });
    corte = siguienteCorte(tarjeta, corte);
  });
  return cuotas;
}

/**
 * E6.1 · Compra nueva a MSI: las cuotas se reparten con mayor residuo (las primeras llevan el centavo
 * extra); la primera se factura en `corteDe(fechaCompra)` avanzado `mesesDiferimiento` cortes.
 */
export function planMsi(
  monto: Centavos,
  meses: number,
  fechaCompra: PlainDate,
  tarjeta: TarjetaCredito,
  mesesDiferimiento = 0,
): CuotaMsi[] {
  exigirCentavos(monto, 'monto', { minimo: 1 });
  exigirEntero(meses, 'meses', 1);
  exigirEntero(mesesDiferimiento, 'mesesDiferimiento', 0);
  let corte = corteDe(tarjeta, fechaCompra);
  for (let i = 0; i < mesesDiferimiento; i++) corte = siguienteCorte(tarjeta, corte);
  return cuotasDesde(
    tarjeta,
    corte,
    distribuirMayorResiduo(
      monto,
      Array.from({ length: meses }, () => 1),
    ),
  );
}

/**
 * E6.1 · Plan que ya existía al registrar la tarjeta: solo las cuotas que faltan, todas iguales a la
 * mensualidad; la primera en el primer corte **estrictamente posterior** a `hoy`.
 */
export function planMsiExistente(
  mensualidad: Centavos,
  restantes: number,
  hoy: PlainDate,
  tarjeta: TarjetaCredito,
): PlanMsiExistente {
  exigirCentavos(mensualidad, 'mensualidad', { minimo: 1 });
  exigirEntero(restantes, 'restantes', 1);
  const cuotas = cuotasDesde(
    tarjeta,
    corteDe(tarjeta, sumarDias(hoy, 1)),
    Array.from({ length: restantes }, () => mensualidad),
  );
  return { saldoMsi: mensualidad * restantes, cuotas };
}

/** E6.1 · Suma de cuotas por mes (`'YYYY-MM'`) de su fecha límite. */
export function compromisoPorMes(cuotas: readonly CuotaMsi[]): Record<string, Centavos> {
  const acumulado: Record<string, Centavos> = {};
  for (const c of cuotas) {
    const mes = c.limite.slice(0, 7);
    acumulado[mes] = (acumulado[mes] ?? 0) + c.monto;
  }
  return acumulado;
}

/** E6.2 · Clave de idempotencia de la reclasificación de la cuota `k` en su corte. */
export function claveCuotaMsi(planId: string, k: number): string {
  return `msi:${planId}:${k}`;
}
