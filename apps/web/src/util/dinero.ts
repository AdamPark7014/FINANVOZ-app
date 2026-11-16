/** «99» o «99.50» → centavos enteros; vacío o inválido → null. Sin pasar por flotantes. */
export function centavosDePesos(texto: string): number | null {
  const t = texto.trim();
  const m = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const enteros = Number(m[1]);
  const fraccion = Number((m[2] ?? '').padEnd(2, '0'));
  return enteros * 100 + fraccion;
}

/** Centavos → texto editable en pesos: 9900 → «99», 9950 → «99.50». */
export function pesosDeCentavos(centavos: number): string {
  const abs = Math.abs(Math.trunc(centavos));
  const resto = abs % 100;
  return `${centavos < 0 ? '-' : ''}${Math.floor(abs / 100)}${resto === 0 ? '' : `.${String(resto).padStart(2, '0')}`}`;
}

/** Formato de UI: $1,500 sin centavos si son .00. */
export function formatearCentavos(centavos: number): string {
  const signo = centavos < 0 ? '\u2212' : '';
  const abs = Math.abs(Math.trunc(centavos));
  const pesos = Math.floor(abs / 100);
  const resto = abs % 100;
  const miles = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(pesos);
  return resto === 0 ? `${signo}$${miles}` : `${signo}$${miles}.${String(resto).padStart(2, '0')}`;
}
