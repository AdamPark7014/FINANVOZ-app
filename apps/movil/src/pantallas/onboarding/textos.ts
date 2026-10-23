/** Copy y TalkBack del onboarding O1–O7 (`02 §3`, `02 §14`, tuteo). */

export {
  TIP_CAPTURA_AHORA_NO,
  TIP_COLCHON_SIN_POR_AHORA,
  TIP_CONSENTIMIENTO,
  TIP_CUENTAS_MINIMO,
  TIP_INGRESO_SALTAR,
  TIP_PAGOS_SALTAR,
} from './tips';

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
export const PISTA_ONB_EMPEZAR = 'Inicia el recorrido de configuración';
export const PISTA_ONB_CONTINUAR = 'Sigue con el siguiente paso del recorrido';

/** O2 · Consentimiento */
export const TITULO_CONSENTIMIENTO = 'Tus datos son tuyos';
export const TITULO_AVISO_SIMPLIFICADO = 'Aviso de privacidad';
export const BTN_ACEPTAR_CONTINUAR = 'Aceptar y continuar';
export const BTN_LEER_AVISO_COMPLETO = 'Leer el aviso completo';
export const PISTA_LEER_AVISO_COMPLETO = 'Abre el aviso de privacidad completo en otra pantalla';
export const PISTA_MARCAR_CASILLA_DATOS = 'Primero marca la casilla de tus datos financieros';
export const CASILLA_DATOS_FINANCIEROS =
  'Acepto que Finanvoz guarde y use mis datos financieros para funcionar, como dice el aviso.';
export const CASILLA_ESTADISTICAS_OPCIONAL =
  'Compartir estadísticas anónimas de uso para mejorar la app (opcional).';

/** O3 · Ingreso */
export const TITULO_INGRESO = '¿Cada cuándo te pagan?';
export const BTN_ONB_SALTAR = 'Saltar por ahora';
export const PISTA_INGRESO_SALTAR = 'Calcularé tu día con los próximos 30 días';
export const PISTA_COMPLETAR_INGRESO = 'Completa los datos de tu ingreso arriba';
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

/** TalkBack O3: la fecha calculada no depende solo del subtítulo visual. */
export function etiquetaProximoPagoOnboarding(fechaLegible: string): string {
  return `${ETIQUETA_PROXIMO_PAGO}: ${fechaLegible}`;
}

/** O4 · Cuentas */
export const TITULO_CUENTAS = '¿Con qué pagas?';
export const PISTA_CUENTAS_CONTINUAR = 'Pasa a tus pagos fijos del mes';
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
export const TITULO_PAGOS_FIJOS = '¿Qué pagos fijos tienes?';
export const AYUDA_PAGOS_FIJOS =
  'Toca los que tengas o agrega otro. Los apartamos antes de decirte cuánto puedes gastar.';
export const ERROR_PAGO_FIJO_INCOMPLETO = 'Escribe cuánto pagas y cuándo lo pagas.';
export const CHIP_PAGO_OTRO = 'Otro';
export const ETIQUETA_PAGO_NOMBRE = '¿Cómo le llamas?';
export const EJEMPLO_PAGO_NOMBRE = 'Netflix, colegiatura, seguro del coche';
export const ERROR_PAGO_NOMBRE = 'Escribe cómo le llamas a este pago.';
export const ETIQUETA_PAGO_FRECUENCIA = '¿Cada cuándo lo pagas?';
export const ETIQUETA_PAGO_DIA_SEMANA = '¿Qué día de la semana?';
export const ETIQUETA_PAGO_MES = '¿En qué mes?';
export const CASILLA_PAGO_VARIABLE = 'El monto cambia cada vez, como un recibo';
export const BTN_PAGO_MAS_OPCIONES = 'Más opciones';
export const BTN_PAGO_MENOS_OPCIONES = 'Menos opciones';
export const PISTA_PAGO_MAS_OPCIONES = 'Muestra de dónde sale el pago y cuántos pagos te faltan';
export const PISTA_PAGO_MENOS_OPCIONES = 'Oculta las opciones extra del pago';
export const ETIQUETA_PAGO_CUENTA = '¿De dónde sale?';
export const CHIP_PAGO_CUENTA_DESPUES = 'Lo decido después';
export const ETIQUETA_PAGO_RESTANTES = '¿Cuántos pagos te faltan?';
export const AYUDA_PAGO_RESTANTES =
  'Déjalo vacío si no tiene fin. Sirve para una tanda, un plan o un préstamo.';
export const ERROR_PAGO_RESTANTES = 'Los pagos que faltan van de 1 a 999, o deja el campo vacío.';
export const BTN_PAGO_QUITAR = 'Quitar';
export const TEXTO_PAGOS_SUMAN = 'Al mes suman';

export function pistaQuitarPago(concepto: string): string {
  return `Quita ${concepto} de tus pagos fijos`;
}

export function etiquetaPagosSuman(montoEnPalabras: string): string {
  return `${TEXTO_PAGOS_SUMAN} ${montoEnPalabras}`;
}

/** TalkBack: una fila de la lista de pagos agregados, con todo lo que se ve. */
export function etiquetaFilaPago(p: {
  concepto: string;
  regla: string;
  montoEnPalabras: string;
  cuenta?: string | null;
  fin?: string | null;
}): string {
  const partes = [p.concepto, p.regla, p.montoEnPalabras];
  if (p.cuenta) partes.push(`sale de ${p.cuenta}`);
  if (p.fin) partes.push(`termina el ${p.fin}`);
  return partes.join(', ');
}
export const ETIQUETA_PAGO_MONTO_FIJO = '¿Cuánto pagas?';
export const ETIQUETA_PAGO_MONTO_VARIABLE = '¿Cuánto pagas más o menos?';
export const AYUDA_PAGO_VARIABLE = 'Cambia cada vez: pon lo de un recibo normal y lo ajustas cuando llegue.';
export const ETIQUETA_PAGO_DIA_MES = '¿Qué día del mes?';
export const PISTA_PAGOS_SALTAR = 'Pasa al siguiente paso sin registrar pagos fijos';
export const PISTA_PAGOS_CONTINUAR = 'Pasa a activar la captura automática';

/** TalkBack O6 · «Ahora no» en ActivarCaptura (complementa el consejo `TIP_CAPTURA_AHORA_NO`). */
export const PISTA_CAPTURA_AHORA_NO = 'Pasa al colchón sin activar la captura automática';

/** TalkBack O4 · tarjeta de crédito opcional en el recorrido. */
export const PISTA_AGREGAR_TARJETA_ONB = 'Abre el formulario de tarjeta de crédito';
export const PISTA_TARJETA_GUARDAR_ONB = 'Guarda la tarjeta con los datos que pusiste';
export const PISTA_TARJETA_DESPUES_ONB = 'Regresa a cuentas sin guardar esta tarjeta';

/** TalkBack O4 · aviso al elegir «No sé» en meses incluidos en el saldo (`02 §3.1`). */
export const AVISO_NO_SE_TARJETA_ONB =
  'No lo resto: puede que cuente de más lo que debes, nunca de menos. Compáralo con tu próximo estado de cuenta.';

export function etiquetaAvisoNoSeTarjetaOnb(): string {
  return `Aviso: ${AVISO_NO_SE_TARJETA_ONB}`;
}

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
export const PISTA_COLCHON_SALTAR = 'Termina el recorrido sin apartar colchón';
export const PISTA_VER_MI_DIA = 'Termina el recorrido y abre tu día';

/**
 * «Dímelo» (Ola 7 §7, maqueta «Onboarding por voz»): cada paso se puede decir completo y termina en la tarjeta
 * «Entendí». En O3 y O7 «Sí» guarda y sigue; en O4 y O5 guarda si está completo y, si no, llena el formulario.
 */
export const TITULO_DECIRLO = 'Dímelo';
export const ejemploDecirlo = (ejemplo: string) => `Como se lo dirías a alguien: «${ejemplo}».`;
export const textoDijiste = (oido: string) => `Dijiste «${oido}».`;
/** Forma corta de «Dímelo» (solo llena el formulario): la persona revisa antes de guardar. */
export const textoLlenado = (oido: string) => `Oí «${oido}». Revisa los datos abajo antes de guardar.`;
export const textoNoEntendido = (oido: string) =>
  `Oí «${oido}», pero no lo entendí. Prueba como en el ejemplo o llena los datos.`;
/** La corrección dicha no cambió nada de la tarjeta. */
export const textoCorreccionNoEntendida = (oido: string) =>
  `Oí «${oido}», pero no supe qué cambiar. Toca «Cambiar algo» o dilo otra vez.`;
export const pistaConfirmarVoz = (correccion: string) =>
  `También puedes tocar el micrófono y decir «sí» o «${correccion}».`;
export const ERROR_GUARDAR_DICHO = 'No pude guardarlo. Intenta otra vez o toca «Cambiar algo».';
/** Mientras el micrófono espera la respuesta a la tarjeta «Entendí» (un turno, tras decirla en voz). */
export const TEXTO_ESPERO_SI_PASO = 'Te escucho: di «sí», «no» o lo que hay que cambiar.';

export const TITULO_ENTENDI = 'Entendí';
export const TITULO_ENTENDI_GUARDO = 'Entendí · ¿lo guardo?';
/** «Entendí · ¿la agrego?» (una cuenta o tarjeta) · «¿las agrego?» · «¿lo agrego?» (un pago) · «¿los agrego?». */
export function tituloEntendiAgrego(cuantos: number, genero: 'f' | 'm'): string {
  const pronombre = genero === 'f' ? 'la' : 'lo';
  return `Entendí · ¿${pronombre}${cuantos > 1 ? 's' : ''} agrego?`;
}
export function btnSiAgrega(cuantos: number, genero: 'f' | 'm'): string {
  const pronombre = genero === 'f' ? 'la' : 'lo';
  return `Sí, agréga${pronombre}${cuantos > 1 ? 's' : ''}`;
}
export const BTN_SI_ASI_ES = 'Sí, así es';
export const BTN_SI_GUARDALO = 'Sí, guárdalo';
export const BTN_SI_SEGUIR = 'Sí, sigo con lo que falta';
export const BTN_CAMBIAR_ALGO = 'Cambiar algo';
export const BTN_ENTENDIDO = 'Entendido';

export const FALTA_DATO = 'Falta';
export const textoMeFalta = (cosas: readonly string[]) => `Me falta saber ${unir(cosas)}.`;
export const EFECTO_APROXIMADO = 'Es una cifra aproximada: corrígela si sabes la exacta.';
export const EFECTO_COLCHON = 'Tu colchón no cuenta para lo que puedes gastar.';
export const textoYaEstanEnLista = (nombres: readonly string[]) =>
  nombres.length === 1
    ? `${nombres[0] ?? ''} ya está en tu lista: no la agrego otra vez.`
    : `${unir(nombres)} ya están en tu lista: no las agrego otra vez.`;
export const TEXTO_EFECTIVO_YA_ESTA = 'Tu efectivo ya está anotado: si cambió, ajústalo en Cuentas.';
export const TEXTO_NADA_NUEVO = 'Eso ya está en tu lista.';
/** Después de «Sí» en O4 y O5: lo agregado, sin cifras (va a la pantalla y al lector). */
export const textoAgregue = (nombres: readonly string[]) => `Listo: agregué ${unir(nombres)}.`;
export const textoCompletaAbajo = (concepto: string) => `Completa ${concepto} abajo.`;
export const textoDimeDespues = (nombres: readonly string[]) => `Después dime ${unir(nombres)} otra vez.`;
export const TEXTO_COMPLETA_TARJETA = 'Completa lo que falta de la tarjeta abajo.';
export const textoTarjetaAgregada = (nombre: string) => `Listo: agregué tu tarjeta ${nombre}.`;

/** Filas de la tarjeta «Entendí». */
export const FILA_CADA_CUANDO = 'Cada cuándo';
export const FILA_CADA_VEZ = '¿Cuánto te pagan cada vez?';
export const FILA_FIN_DE_SEMANA = 'Si cae en fin de semana';
export const FILAS_TARJETA = {
  nombre: 'Tarjeta',
  corte: 'Corta',
  limite_pago: 'Pagas',
  limite_credito: 'Límite de crédito',
  saldo: 'Debes hoy',
  modo: '¿La pagas completa?',
} as const;

/** Lo que falta, para «Me falta saber…». */
export const FALTANTES_INGRESO = {
  dia_semana: 'qué día te pagan',
  ancla: 'cuándo te pagan la próxima vez',
  dia_mes: 'qué día del mes te pagan',
  monto: 'cuánto te pagan',
} as const;
export const FALTANTES_PAGO = {
  frecuencia: 'cada cuándo',
  dia: 'el día',
  dia_semana: 'el día de la semana',
  mes: 'el mes',
} as const;
export const FALTANTES_PAGO_FRASE = {
  frecuencia: 'cada cuándo pagas',
  dia: 'qué día pagas',
  dia_semana: 'qué día de la semana pagas',
  mes: 'en qué mes pagas',
} as const;
export const textoEscribeAbajo = (cosas: readonly string[]) => `Escribe abajo ${unir(cosas)}.`;
export const FALTANTES_TARJETA = {
  nombre: 'cómo se llama',
  corte: 'qué día corta',
  limite_pago: 'cuándo la pagas',
  limite_credito: 'tu límite de crédito',
  modo: 'si la pagas completa',
  saldo: 'cuánto debes hoy',
  msi: 'si tu saldo ya incluye los meses',
} as const;

function unir(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? '';
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1] ?? ''}`;
}

/** TalkBack: el consejo no depende solo del color del texto secundario. */
export function etiquetaTipOnboarding(tip: string): string {
  return `Consejo: ${tip}`;
}

/** Texto visible del indicador «Paso n de 7». */
export function textoProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `Paso ${paso} de ${total}`;
}

/** TalkBack: el contador de pasos no depende solo del color. */
export function etiquetaProgresoOnboarding(paso: number, total: number = PASOS_ONBOARDING): string {
  return `${textoProgresoOnboarding(paso, total)} del recorrido inicial`;
}

/** En iPhone no hay O6 (captura de notificaciones, `02 §25`): 6 pasos; en Android, los 7 de `02 §3`. */
export function pasosVisiblesOnboarding(omitirCaptura: boolean): number {
  return omitirCaptura ? PASOS_ONBOARDING - 1 : PASOS_ONBOARDING;
}

/** El número que ve la persona para O1–O7: sin captura, el colchón (O7) es el paso 6. */
export function numeroPasoOnboarding(o: 1 | 2 | 3 | 4 | 5 | 6 | 7, omitirCaptura: boolean): number {
  return omitirCaptura && o === 7 ? 6 : o;
}

/** Lo lleno de la barra de progreso en puntos base (0–10 000): el paso n de N llena n/N. */
export function progresoOnboardingBp(paso: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(Math.min(Math.max(paso / total, 0), 1) * 10_000);
}

/** TalkBack: pista del indicador «Paso n de 7». */
export const PISTA_PROGRESO_ONB = 'Indica en qué paso vas del recorrido inicial';

/** TalkBack: chips de una sola opción en O3–O5. */
export const PISTA_CHIP_ONB_ELEGIR = 'Toca para seleccionar esta opción';
export const PISTA_CHIP_ONB_SELECCIONADA = 'Opción seleccionada';

/** TalkBack: casillas de consentimiento y similares. */
export const PISTA_CASILLA_ONB = 'Toca para marcar o desmarcar';

/** TalkBack O1–O7: encabezado del paso (título visible). */
export function etiquetaTituloPasoOnboarding(titulo: string): string {
  return titulo;
}

/** TalkBack: texto de ayuda bajo el título. */
export function etiquetaAyudaPasoOnboarding(ayuda: string): string {
  return ayuda;
}

/**
 * Anuncio al entrar a un paso (TalkBack): progreso + título, sin datos personales.
 * Solo se usa con `AccessibilityInfo.announceForAccessibility`.
 */
export function anuncioCambioPasoOnboarding(
  paso: number,
  titulo: string,
  total: number = PASOS_ONBOARDING,
): string {
  return `${textoProgresoOnboarding(paso, total)}. ${titulo}`;
}
