/** Redacción Ajustes › Datos para cobrar (`02 §17`): tuteo; formatos vienen de `servicios/`. */

export const SECCION_DATOS_COBRO = 'Datos para cobrar';

export const RESUMEN_VACIO = 'Agrega tu celular o tu CLABE para mandarlos cuando cobras.';

export const BTN_AGREGAR = 'Agregar';
export const BTN_CAMBIAR = 'Cambiar';
export const BTN_BORRAR = 'Borrar mis datos para cobrar';

/** TalkBack sin datos guardados (`02 §17`). */
export const PISTA_AGREGAR_DATOS_COBRO = 'Abre el formulario para agregar tu celular o CLABE';
/** TalkBack cuando ya hay celular o CLABE (`02 §17`). */
export const PISTA_CAMBIAR_DATOS_COBRO = 'Abre el formulario para cambiar tu celular o CLABE';
/** TalkBack al quitar los datos de este teléfono (`02 §17`). */
export const PISTA_BORRAR_DATOS_COBRO = 'Quita tu celular y CLABE de este teléfono';

export function lineaResumenCelular(celularFormateado: string): string {
  return `Celular: ${celularFormateado}`;
}

export function lineaResumenClabe(clabeFormateada: string): string {
  return `CLABE: ${clabeFormateada}`;
}

/** TalkBack del resumen bajo el título de sección (`02 §15`). */
export function etiquetaResumenDatosCobro(texto: string): string {
  return `${SECCION_DATOS_COBRO}. ${texto}`;
}

/** TalkBack: el resumen cambia al guardar o borrar (`02 §17`). */
export const PISTA_RESUMEN_DATOS_COBRO =
  'Se actualiza cuando guardas o borras tu celular o CLABE';
