/** Redacción Ajustes › Datos para cobrar (`02 §17`): tuteo; formatos vienen de `servicios/`. */

export const SECCION_DATOS_COBRO = 'Datos para cobrar';

export const RESUMEN_VACIO = 'Agrega tu celular o tu CLABE para mandarlos cuando cobras.';

export const BTN_AGREGAR = 'Agregar';
export const BTN_CAMBIAR = 'Cambiar';
export const BTN_BORRAR = 'Borrar mis datos para cobrar';

export function lineaResumenCelular(celularFormateado: string): string {
  return `Celular: ${celularFormateado}`;
}

export function lineaResumenClabe(clabeFormateada: string): string {
  return `CLABE: ${clabeFormateada}`;
}
