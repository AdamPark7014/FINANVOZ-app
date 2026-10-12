import { type Centavos, ErrorDominio } from '@cartera/core';

const IMPORTE = /^(-?)(\d+)(?:\.(\d{1,6}))?$/;

/**
 * E13.1 · Importe de un CFDI (`"1160.00"`, hasta 6 decimales) a centavos, en aritmética entera:
 * redondeo al centavo con la mitad hacia arriba (`"0.005"` → 1, `"0.004999"` → 0). Sin flotantes.
 */
export function decimalACentavos(texto: string): Centavos {
  const m = IMPORTE.exec(texto.trim());
  if (!m) throw new ErrorDominio('importe_invalido', 'importe con formato no reconocido');
  const [, signo, entero = '', decimales = ''] = m;
  const millonesimas = BigInt(entero) * 1_000_000n + BigInt(decimales.padEnd(6, '0'));
  const centavos = (millonesimas + 5_000n) / 10_000n;
  const resultado = Number(signo === '-' ? -centavos : centavos);
  if (!Number.isSafeInteger(resultado)) {
    throw new ErrorDominio('importe_invalido', 'importe fuera de rango');
  }
  // `-0` no es un monto distinto de 0.
  return resultado === 0 ? 0 : resultado;
}
