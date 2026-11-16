/** Etiquetas de UI para los valores de la base (una sola fuente para todas las pantallas). */
export const PRODUCTOS: Record<string, string> = {
  plus_mensual: 'Plus mensual',
  plus_anual: 'Plus anual',
  licencias: 'Licencias',
};

export const ESTADOS_VENTA: Record<string, string> = {
  por_cobrar: 'Por cobrar',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
};

export const ETAPAS: { id: string; etiqueta: string }[] = [
  { id: 'nuevo', etiqueta: 'Nuevos' },
  { id: 'contactado', etiqueta: 'Contactados' },
  { id: 'demo', etiqueta: 'Demo' },
  { id: 'propuesta', etiqueta: 'Propuesta' },
  { id: 'ganado', etiqueta: 'Ganados' },
  { id: 'perdido', etiqueta: 'Perdidos' },
];

export const ORIGENES: Record<string, string> = {
  pagina: 'Página de venta',
  referido: 'Referido',
  lista_espera: 'Lista de espera',
  llamada: 'Llamada',
  otro: 'Otro',
};

export const INTERESES: Record<string, string> = {
  plus: 'Plus',
  licencias: 'Licencias',
  otro: 'Otro',
};

export const TIPOS_CLIENTE: Record<string, string> = {
  persona: 'Persona',
  negocio: 'Negocio',
  institucion: 'Institución',
};

/** «40 licencias · 12 meses», «Plus anual» */
export function describirVenta(v: { producto: string; cantidad: number; meses: number }): string {
  if (v.producto === 'licencias') {
    return `${v.cantidad} ${v.cantidad === 1 ? 'licencia' : 'licencias'} · ${v.meses} ${v.meses === 1 ? 'mes' : 'meses'}`;
  }
  const nombre = PRODUCTOS[v.producto] ?? v.producto;
  return v.cantidad > 1 ? `${nombre} × ${v.cantidad}` : nombre;
}
