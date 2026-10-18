/** Copy de deducciones (`02 §24`, `08 §1`, tuteo); las cifras vienen de motores, no de aquí. */
export { AVISO_DEDUCIBLE_EFECTIVO, LEYENDA_ESTIMACION, MENSAJE_SIN_PARAMETROS } from '../../servicios/deducciones';

export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Regresa a Cuentas';

/** Candado Plus al entrar desde Cuentas. */
export const TITULO_PUERTA_PLUS = 'Tus deducciones del año';
export const DESCRIPCION_PUERTA_PLUS =
  'Con Plus, comparte tus facturas y te digo cuánto llevas deducible en el año, qué no cuenta y por qué, y cuánto ISR podrías pagar de menos.';

export function tituloPantallaDeducciones(ejercicio: number): string {
  return `Deducciones ${ejercicio}`;
}

/** Perfil fiscal la primera vez o al editar. */
export const PEDIR_PERFIL =
  'Para estimar, necesito tu RFC, tus ingresos brutos del año (los de tu constancia de sueldos, incluidos los exentos) y, si la tienes, tu base gravable.';
export const PERFIL_EN_TELEFONO = 'Se guardan solo en tu teléfono.';
export const ERROR_RFC = 'Revisa tu RFC: son 13 letras y números, como aparece en tu constancia.';
export const ERROR_INGRESOS = 'Escribe tus ingresos brutos del año.';
export const ETIQUETA_RFC = 'Tu RFC';
export const EJEMPLO_RFC = 'PEPJ800101AB1';
export const ETIQUETA_INGRESOS_BRUTOS = 'Ingresos brutos del año';
export const ETIQUETA_BASE_GRAVABLE = 'Base gravable (opcional)';
export const AYUDA_BASE_GRAVABLE = 'Viene en tu constancia de sueldos o te la da tu contador.';
export const ETIQUETA_GUARDAR = 'Guardar';
export const ETIQUETA_CANCELAR = 'Cancelar';
export const BTN_CAMBIAR_PERFIL = 'Cambiar mi RFC o mis ingresos';

export const BTN_IMPORTAR_FACTURAS = 'Importar facturas (XML o ZIP)';
export const MENSAJE_IMPORTAR_ERROR =
  'No pude leer esos archivos. Vuelve a compartirlos o elígelos otra vez.';

/** Lista de facturas del ejercicio vacía (`02 §24`). */
export const TEXTO_FACTURAS_VACIO =
  'Todavía no tienes facturas de este año. Comparte el XML o un ZIP desde tu correo, el portal del SAT o el botón de abajo.';

export const TITULO_TUS_FACTURAS = 'Tus facturas';

/** Vacío de facturas: encabezado de sección + copy para TalkBack (`02 §15`). */
export function etiquetaVacioFacturas(): string {
  return `${TITULO_TUS_FACTURAS}. ${TEXTO_FACTURAS_VACIO}`;
}

export const TITULO_FACTURAS_OCULTAS = 'Importadas por error';
export const TEXTO_FACTURAS_OCULTAS =
  'No entran en tu estimación. Si fue un error, puedes volver a mostrarlas.';

export const ETIQUETA_NO_DEDUCIBLES = 'No deducibles';

/** Hoja de compartir (`expo-sharing`). */
export const TITULO_IMPORTAR_COMPARTIDAS = 'Importar facturas';
export const TEXTO_IMPORTAR_LEYENDO = 'Leyendo tus facturas…';

/** Hoja de compartir sin archivos (`02 §24`). */
export const TEXTO_IMPORTAR_VACIO =
  'No llegó ningún archivo. Comparte el XML de la factura o un ZIP del SAT.';

/** Vacío al importar por compartir: título + copy para TalkBack (`02 §15`). */
export function etiquetaVacioImportar(): string {
  return `${TITULO_IMPORTAR_COMPARTIDAS}. ${TEXTO_IMPORTAR_VACIO}`;
}

export const BTN_VER_DEDUCCIONES = 'Ver mis deducciones';
/** Entrada desde Cuentas (`02 §24`). */
export const BTN_DEDUCCIONES_CUENTAS = 'Ver mis deducciones del año';
export const ETIQUETA_IMPORTACION_LISTO = 'Listo';

/** Detalle por factura. */
export const ETIQUETA_COLEGIATURA_DE_QUIEN = '¿De quién es la colegiatura?';
export const ETIQUETA_NIVEL = 'Nivel';
export const BTN_GUARDAR_ALUMNO_NIVEL = 'Guardar alumno y nivel';
export const ETIQUETA_LENTES = 'Son lentes ópticos';
export const DESC_LENTES = 'En el año, los lentes tienen tope aparte del resto de salud.';
export const ETIQUETA_BENEFICIARIO_LENTES = '¿De quién son?';
export const BTN_YA_LA_PAGUE = 'Ya la pagué';
export const ETIQUETA_FORMA_PAGO = '¿Cómo la pagaste?';
export const BTN_CANCELADA_SAT = 'La cancelaron en el SAT';
export const BTN_NO_CANCELADA_SAT = 'Ya no está cancelada';
export const BTN_OCULTAR_FACTURA = 'La importé por error';
export const BTN_RECUPERAR_FACTURA = 'Volver a mostrar';

export const ESTADO_DEDUCIBLE = 'Deducible';

/** TalkBack: la leyenda `LEYENDA_ESTIMACION` (`08 §1`). */
export const ETIQUETA_LEYENDA_ESTIMACION = 'Aviso sobre estimaciones fiscales';
