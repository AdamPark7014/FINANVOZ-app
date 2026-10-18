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

/** Texto visible del indicador «Paso n de 7». */
export function textoProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `Paso ${paso} de ${total}`;
}

/** TalkBack: el contador de pasos no depende solo del color. */
export function etiquetaProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `${textoProgresoOnboarding(paso, total)} del recorrido inicial`;
}
