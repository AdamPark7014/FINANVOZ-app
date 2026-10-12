import type { Centavos } from '@cartera/core';

/**
 * Convierte lo que escribe la persona ("20,000", "$1,099.9", "1500") a centavos sin pasar por flotantes.
 * Devuelve `null` si no es un monto válido; vacío es `null`.
 */
export function leerPesos(texto: string): Centavos | null {
  const limpio = texto.replace(/[\s$]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const m = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(limpio);
  if (!m) return null;
  const pesos = m[1] ?? '0';
  const centavos = (m[2] ?? '').padEnd(2, '0');
  return Number(pesos) * 100 + Number(centavos);
}

const miles = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** `$1,500` sin centavos si son .00; `$1,099.90` con centavos; negativos con "−" (02-UX §14). */
export function formatearPesos(c: Centavos): string {
  const signo = c < 0 ? '−' : '';
  const abs = Math.abs(c);
  const pesos = Math.floor(abs / 100);
  const resto = abs % 100;
  const parteCentavos = resto === 0 ? '' : `.${String(resto).padStart(2, '0')}`;
  return `${signo}$${miles.format(pesos)}${parteCentavos}`;
}
