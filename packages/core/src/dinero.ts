import { ErrorDominio } from './errores';

/** Dinero en centavos enteros (regla 1). `150000` = $1,500.00. */
export type Centavos = number;

/** Puntos base: 10000 = 100 %. */
export type PuntosBase = number;

export function esCentavos(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

export function exigirCentavos(
  valor: unknown,
  campo: string,
  { minimo = 0 }: { minimo?: number } = {},
): Centavos {
  if (!esCentavos(valor) || valor < minimo) {
    throw new ErrorDominio('monto_invalido', `${campo} debe ser un entero de centavos ≥ ${minimo}`);
  }
  return valor;
}
