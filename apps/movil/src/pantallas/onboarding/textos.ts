/** Copy y TalkBack del onboarding O1–O7 (`02 §3`, `02 §14`, tuteo). */

/** Total de pasos visibles del onboarding (O1–O7, `02 §3`). */
export const PASOS_ONBOARDING = 7;

export const ERROR_GUARDAR = 'No pude guardar eso. Revisa los datos e intenta de nuevo.';

/** O1 · Bienvenida */
export const TITULO_BIENVENIDA = 'Sabe cada día cuánto puedes gastar';
export const AYUDA_BIENVENIDA =
  'Sin quedarte corto antes de tu próximo pago. Te toma unos 4 minutos y todo se queda en tu teléfono.';
export const CUERPO_BIENVENIDA =
  'Anota lo que tienes, lo que debes y tus pagos fijos. Finanvoz hace las cuentas por ti.';
export const BTN_ONB_EMPEZAR = 'Empezar';
export const BTN_ONB_CONTINUAR = 'Continuar';

/** O2 · Consentimiento */
export const TITULO_CONSENTIMIENTO = 'Tus datos son tuyos';
export const TITULO_AVISO_SIMPLIFICADO = 'Aviso de privacidad';
export const BTN_ACEPTAR_CONTINUAR = 'Aceptar y continuar';
export const BTN_LEER_AVISO_COMPLETO = 'Leer el aviso completo';
export const PISTA_MARCAR_CASILLA_DATOS = 'Primero marca la casilla de tus datos financieros';
export const CASILLA_DATOS_FINANCIEROS =
  'Acepto que Finanvoz guarde y use mis datos financieros para funcionar, como dice el aviso.';
export const CASILLA_ESTADISTICAS_OPCIONAL =
  'Compartir estadísticas anónimas de uso para mejorar la app (opcional).';

/** O3 · Ingreso */
export const TITULO_INGRESO = '¿Cada cuándo te pagan?';
export const BTN_ONB_SALTAR = 'Saltar por ahora';

/** O5 · Pagos fijos */
export const TITULO_PAGOS_FIJOS = '¿Qué pagos tienes cada mes?';
export const AYUDA_PAGOS_FIJOS =
  'Toca los que tengas. Los apartamos antes de decirte cuánto puedes gastar.';
export const ERROR_PAGO_FIJO_INCOMPLETO = 'Escribe cuánto pagas y qué día del mes (1 a 31).';
export const ETIQUETA_PAGO_MONTO_FIJO = '¿Cuánto pagas?';
export const ETIQUETA_PAGO_MONTO_VARIABLE = '¿Cuánto pagas más o menos?';
export const AYUDA_PAGO_VARIABLE =
  'Cambia cada vez: pon lo de un recibo normal y lo ajustas cuando llegue.';
export const ETIQUETA_PAGO_DIA_MES = '¿Qué día del mes?';

export function etiquetaAgregarPago(concepto: string): string {
  return `Agregar ${concepto}`;
}

/** O7 · Colchón */
export const TITULO_COLCHON = '¿Cuánto quieres no tocar nunca?';
export const AYUDA_COLCHON_ONB =
  'Tu colchón no cuenta para lo que puedes gastar. Lo cambias cuando quieras en Ajustes › Colchón.';
export const ETIQUETA_COLCHON = 'Tu colchón';
export const BTN_VER_MI_DIA = 'Ver mi día';
export const BTN_SIN_COLCHON_POR_AHORA = 'Sin colchón por ahora';

/** Texto visible del indicador «Paso n de 7». */
export function textoProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `Paso ${paso} de ${total}`;
}

/** TalkBack: el contador de pasos no depende solo del color. */
export function etiquetaProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `${textoProgresoOnboarding(paso, total)} del recorrido inicial`;
}
