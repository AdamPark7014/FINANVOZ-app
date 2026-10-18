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
export const PISTA_INGRESO_SALTAR = 'Calcularé tu día con los próximos 30 días';
export const CUERPO_INGRESO_VARIABLE =
  'Sin problema: calcularé cuánto puedes gastar con los próximos 30 días.';
export const ETIQUETA_DIA_SEMANA_INGRESO = '¿Qué día te pagan?';
export const ETIQUETA_PROXIMA_VEZ_INGRESO = '¿Cuándo te pagan la próxima vez?';
export const ETIQUETA_DIA_MES_INGRESO = '¿Qué día del mes te pagan?';
export const EJEMPLO_DIA_MES_INGRESO = '30';
export const ERROR_DIA_MES_INGRESO = 'Escribe un día del 1 al 31.';
export const ETIQUETA_MONTO_INGRESO = '¿Cuánto te pagan cada vez?';
export const AYUDA_MONTO_INGRESO = 'Lo que te llega a la cuenta, ya con descuentos.';
export const ETIQUETA_FIN_DE_SEMANA_INGRESO = 'Si cae en fin de semana te pagan:';
export const ETIQUETA_PROXIMO_PAGO = 'Tu próximo pago';

/** O4 · Cuentas */
export const TITULO_CUENTAS = '¿Con qué pagas?';
export const TIP_CUENTAS_MINIMO =
  'Puedes tocar «Continuar» solo con efectivo; cuentas, billeteras y tarjetas las agregas después en Cuentas.';
export const ETIQUETA_EFECTIVO_ONB = '¿Cuánto efectivo traes ahorita?';
export const AYUDA_EFECTIVO_ONB = 'Si no sabes exacto, pon lo que calcules. Lo ajustas después.';
export const ERROR_CUENTA_INCOMPLETA = 'Escribe el nombre y el saldo de la cuenta.';
export const ETIQUETAS_SUBTIPO_CUENTA: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};
export const ETIQUETA_CUENTA_GENERICA = 'Cuenta';
export const SUFIJO_TIENES = ' · tienes';
export const ETIQUETA_TARJETA_DEBES = 'Tarjeta de crédito · debes';
export const ETIQUETA_CHIP_DEBITO = 'Débito';
export const ETIQUETA_CHIP_BILLETERA = 'Billetera';
export const ETIQUETA_CHIP_AHORRO = 'Ahorro';
export const ETIQUETA_NOMBRE_CUENTA = 'Nombre';
export const EJEMPLO_NOMBRE_BILLETERA = 'Mercado Pago';
export const EJEMPLO_NOMBRE_DEBITO = 'BBVA';
export const ETIQUETA_SALDO_CUENTA_ONB = '¿Cuánto tienes hoy?';
export const BTN_AGREGAR_CUENTA_ONB = 'Agregar cuenta';
export const BTN_ONB_CANCELAR = 'Cancelar';
export const BTN_AGREGAR_DEBITO_BILLETERA = 'Agregar débito o billetera';
export const BTN_AGREGAR_TARJETA_CREDITO = 'Agregar tarjeta de crédito';

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
export const TIP_PAGOS_SALTAR =
  'Si hoy no quieres registrar pagos fijos, toca «Saltar por ahora»; los agregas cuando quieras desde Hoy.';

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
export const TIP_COLCHON_SIN_POR_AHORA =
  'Si hoy no quieres apartar nada, toca «Sin colchón por ahora»; lo configuras cuando quieras en Ajustes › Colchón.';

/** Texto visible del indicador «Paso n de 7». */
export function textoProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `Paso ${paso} de ${total}`;
}

/** TalkBack: el contador de pasos no depende solo del color. */
export function etiquetaProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `${textoProgresoOnboarding(paso, total)} del recorrido inicial`;
}
