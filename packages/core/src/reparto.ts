import { exigirCentavos, type Centavos } from './dinero';
import { ErrorDominio } from './errores';

/**
 * E1.1 · Reparte `total` en proporción a `pesos` sin perder ni inventar centavos (`docs/05-MOTORES.md §E1.1`).
 * Los productos se hacen en BigInt para que `T·p_i` nunca pierda precisión.
 */
export function distribuirMayorResiduo(total: Centavos, pesos: readonly number[]): Centavos[] {
  exigirCentavos(total, 'total', { minimo: Number.MIN_SAFE_INTEGER });
  if (pesos.length === 0 || pesos.some((p) => !Number.isSafeInteger(p) || p < 0)) {
    throw new ErrorDominio('pesos_invalidos', 'los pesos deben ser enteros ≥ 0');
  }
  const w = pesos.reduce((suma, p) => suma + BigInt(p), 0n);
  if (w === 0n) throw new ErrorDominio('pesos_invalidos', 'la suma de pesos debe ser > 0');
  if (total === 0) return pesos.map(() => 0);

  const t = BigInt(Math.abs(total));
  const base = pesos.map((p) => (t * BigInt(p)) / w);
  const resto = pesos.map((p) => (t * BigInt(p)) % w);
  let faltante = Number(t - base.reduce((a, b) => a + b, 0n));

  const orden = pesos
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = resto[a] as bigint;
      const rb = resto[b] as bigint;
      return ra === rb ? a - b : ra > rb ? -1 : 1;
    });
  for (const i of orden) {
    if (faltante === 0) break;
    base[i] = (base[i] as bigint) + 1n;
    faltante--;
  }
  const signo = total < 0 ? -1 : 1;
  return base.map((b) => (b === 0n ? 0 : signo * Number(b)));
}
