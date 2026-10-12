import { exigirCentavos, type Centavos, type PuntosBase } from './dinero';
import { ErrorDominio } from './errores';
import { distribuirMayorResiduo } from './reparto';

/** Plazos que muestra la calculadora (`docs/09-ROADMAP.md` M0). */
export const PLAZOS_MSI = [3, 6, 9, 12, 18, 24] as const;
export type PlazoMsi = (typeof PLAZOS_MSI)[number];

/** Referencias citadas en pantalla: Condusef (deuda total) y especialistas (MSI). */
export interface ParametrosCapacidad {
  readonly topeDeudaBp: PuntosBase;
  readonly topeMsiBp: PuntosBase;
}

export const PARAMETROS_CAPACIDAD: ParametrosCapacidad = { topeDeudaBp: 3000, topeMsiBp: 1000 };

export interface EntradaCapacidad {
  readonly ingresoMensualNeto: Centavos;
  /** Total de pagos mensuales de deudas, incluidos los MSI. */
  readonly pagosDeudaMensuales: Centavos;
  /** Parte de `pagosDeudaMensuales` que es MSI. */
  readonly pagosMsiMensuales: Centavos;
  readonly compra?: { readonly precio: Centavos; readonly meses: number } | undefined;
}

export type Limitante = 'deuda_total' | 'msi';

export interface ResultadoCompra {
  readonly cuotaMaxima: Centavos;
  readonly cabe: boolean;
  /** Negativo cuando no cabe. */
  readonly margen: Centavos;
}

export interface ResultadoCapacidad {
  readonly topeDeuda: Centavos;
  readonly topeMsi: Centavos;
  readonly capacidadMensual: Centavos;
  readonly limitante: Limitante;
  /** Los pagos actuales ya pasan alguno de los dos topes (no solo lo igualan). */
  readonly rebasaRecomendacion: boolean;
  readonly precioMaximo: Readonly<Record<PlazoMsi, Centavos>>;
  readonly compra?: ResultadoCompra;
}

function porcentajeBp(monto: Centavos, bp: PuntosBase): Centavos {
  return Number((BigInt(monto) * BigInt(bp)) / 10000n);
}

/** E10 · Capacidad de endeudamiento (`docs/05-MOTORES.md §E10`). */
export function capacidadEndeudamiento(
  entrada: EntradaCapacidad,
  parametros: ParametrosCapacidad = PARAMETROS_CAPACIDAD,
): ResultadoCapacidad {
  const ingreso = exigirCentavos(entrada.ingresoMensualNeto, 'ingresoMensualNeto');
  const deuda = exigirCentavos(entrada.pagosDeudaMensuales, 'pagosDeudaMensuales');
  const msi = exigirCentavos(entrada.pagosMsiMensuales, 'pagosMsiMensuales');
  if (msi > deuda) {
    throw new ErrorDominio('msi_mayor_que_deuda', 'los pagos de MSI forman parte de los pagos de deudas');
  }

  const topeDeuda = porcentajeBp(ingreso, parametros.topeDeudaBp);
  const topeMsi = porcentajeBp(ingreso, parametros.topeMsiBp);
  const capDeuda = topeDeuda - deuda;
  const capMsi = topeMsi - msi;
  const capacidadMensual = Math.max(0, Math.min(capDeuda, capMsi));
  const limitante: Limitante = capDeuda <= capMsi ? 'deuda_total' : 'msi';

  const precioMaximo = Object.fromEntries(PLAZOS_MSI.map((n) => [n, capacidadMensual * n])) as Record<
    PlazoMsi,
    Centavos
  >;

  const resultado: ResultadoCapacidad = {
    topeDeuda,
    topeMsi,
    capacidadMensual,
    limitante,
    rebasaRecomendacion: capDeuda < 0 || capMsi < 0,
    precioMaximo,
  };
  if (!entrada.compra) return resultado;

  const precio = exigirCentavos(entrada.compra.precio, 'compra.precio');
  const meses = entrada.compra.meses;
  if (!Number.isSafeInteger(meses) || meses < 1) {
    throw new ErrorDominio('meses_invalidos', 'los meses deben ser un entero ≥ 1');
  }
  const cuotas = distribuirMayorResiduo(
    precio,
    Array.from({ length: meses }, () => 1),
  );
  const cuotaMaxima = Math.max(...cuotas);
  return {
    ...resultado,
    compra: { cuotaMaxima, cabe: cuotaMaxima <= capacidadMensual, margen: capacidadMensual - cuotaMaxima },
  };
}
