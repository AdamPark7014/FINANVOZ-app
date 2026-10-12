/** Jaro según 05 §E9.2: ventana `max(piso(max(|a|,|b|)/2) − 1, 0)`, `t` sin redondear. */
export function jaro(a: string, b: string): number {
  if (a === b) return a === '' ? 0 : 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const ventana = Math.max(Math.floor(Math.max(la, lb) / 2) - 1, 0);
  const usadasA: boolean[] = new Array<boolean>(la).fill(false);
  const usadasB: boolean[] = new Array<boolean>(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - ventana); j < Math.min(i + ventana + 1, lb); j++) {
      if (!usadasB[j] && a[i] === b[j]) {
        usadasA[i] = true;
        usadasB[j] = true;
        m++;
        break;
      }
    }
  }
  if (m === 0) return 0;
  let fuera = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!usadasA[i]) continue;
    while (!usadasB[k]) k++;
    if (a[i] !== b[k]) fuera++;
    k++;
  }
  const t = fuera / 2;
  return (m / la + m / lb + (m - t) / m) / 3;
}

/** Jaro–Winkler (05 §E9.2): si `jaro > 0.7`, `jaro + l·0.1·(1 − jaro)` con prefijo común `l ≤ 4`. */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j <= 0.7) return j;
  let prefijo = 0;
  while (prefijo < 4 && prefijo < a.length && prefijo < b.length && a[prefijo] === b[prefijo]) prefijo++;
  return j + prefijo * 0.1 * (1 - j);
}
