import type { VistaWidget } from '../servicios';
import { etiquetaHablada } from '../ui/formato';

/** Separador visual antes de los días (`· 4 días`). */
export function detalleConSeparador(detalle: string | null): string | null {
  return detalle === null ? null : `· ${detalle}`;
}

/**
 * Etiqueta de TalkBack de la vista completa (02-UX §15): cada `$` del texto se lee en palabras,
 * incluidos centavos cuando la cifra trae decimales.
 */
export function etiquetaAccesibleWidget(vista: VistaWidget): string {
  return etiquetaHablada(vista.texto);
}

/** Tamaño de la cifra en el widget 2×1 según longitud visible (`$1,500.99` → más compacto). */
export function tamanoFuenteCifra(cifra: string): number {
  if (cifra.length <= 7) return 22;
  if (cifra.length <= 11) return 20;
  return 18;
}
