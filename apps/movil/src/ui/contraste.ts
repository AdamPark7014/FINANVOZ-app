/** Razón de contraste WCAG 2.x entre dos colores `#RRGGBB`. */
export function razonContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new TypeError(`Color no soportado: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const s = parseInt(h ?? '0', 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
