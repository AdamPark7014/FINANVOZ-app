import { ErrorDominio } from './errores';

/** E1.3: entero, mitad hacia arriba, sin flotantes. `redondearPorcentaje(7066, 10000)` = 71. */
export function redondearPorcentaje(num: number, den: number): number {
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den <= 0 || num < 0) {
    throw new ErrorDominio('porcentaje_invalido', 'num ≥ 0 y den > 0 enteros');
  }
  return Number((BigInt(num) * 200n + BigInt(den)) / (2n * BigInt(den)));
}

/** E1.3: nunca "0 %" ni "100 %" para una probabilidad simulada. */
export function porcentajeMostrado(exitos: number, n: number): string {
  const p = redondearPorcentaje(exitos, n);
  if (p === 0) return '< 1 %';
  if (p === 100) return '> 99 %';
  return `${p} %`;
}
