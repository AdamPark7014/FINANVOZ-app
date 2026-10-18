/**
 * A qué pantalla lleva tocar un aviso local. Solo mira el prefijo del id del aviso (`tarjeta:`, `cobro:`, …), que
 * ya es determinista; en la ruta viajan ids, nunca montos ni nombres (regla 9). Puro: sin React ni Expo.
 */

/** Hoy: donde viven las tarjetas de acción ("¿Ya pagaste…?", "¿Ya te pagaron?") y el riesgo de no llegar. */
export const RUTA_HOY = '/hoy';

const segmento = (s: string) => encodeURIComponent(s);

/** Lo que va antes de la última `:` (la fecha del aviso), o `null` si no hay. */
function antesDeLaFecha(resto: string): string | null {
  const i = resto.lastIndexOf(':');
  return i > 0 ? resto.slice(0, i) : null;
}

/**
 * La ruta de Expo Router de un aviso por su id:
 * `cobro:<persona>` → detalle de la persona; `tarjeta:<corte|limite>:<tarjeta>:<fecha>` → detalle de la tarjeta;
 * `tanda:<tanda>:<fecha>` → detalle de la tanda; `respaldo:` → Ajustes › Respaldo; `me-alcanza:` → "¿Me alcanza?";
 * `riesgo:`, `compromiso:`, `ingreso:` y cualquier otro → Hoy.
 */
export function rutaDeAviso(id: string): string {
  const dosPuntos = id.indexOf(':');
  if (dosPuntos < 0) return RUTA_HOY;
  const prefijo = id.slice(0, dosPuntos + 1);
  const resto = id.slice(dosPuntos + 1);
  switch (prefijo) {
    case 'cobro:':
      return resto ? `/persona/${segmento(resto)}` : RUTA_HOY;
    case 'tarjeta:': {
      const tipo = resto.indexOf(':');
      const tarjeta = tipo > 0 ? antesDeLaFecha(resto.slice(tipo + 1)) : null;
      return tarjeta ? `/tarjetas/${segmento(tarjeta)}` : RUTA_HOY;
    }
    case 'tanda:': {
      const tanda = antesDeLaFecha(resto);
      return tanda ? `/tandas/${segmento(tanda)}` : RUTA_HOY;
    }
    case 'respaldo:':
      return '/respaldo';
    case 'me-alcanza:':
      return '/me-alcanza';
    default:
      return RUTA_HOY;
  }
}

/** Solo rutas internas de la app (`/algo/…`): nada de esquemas, hosts (`//`) ni consultas. */
export function rutaSegura(ruta: unknown): string | null {
  return typeof ruta === 'string' && /^\/(?!\/)[\w\-./%]*$/.test(ruta) ? ruta : null;
}

/** A dónde ir al tocar un aviso: la ruta guardada en el aviso si es interna; si no, la que dice su id. */
export function destinoDeAviso(aviso: { readonly id: string; readonly ruta?: unknown }): string {
  return rutaSegura(aviso.ruta) ?? rutaDeAviso(aviso.id);
}
