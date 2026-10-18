import { ErrorDominio } from '@cartera/core';
import { etiquetaHablada, formatearCentavos } from '../../ui';
import {
  MENSAJE_LIMITE_DIARIO,
  MENSAJE_LIMITE_MENSUAL_GRATIS,
  MENSAJE_LIMITE_MENSUAL_PLUS,
} from '../plan/textos';
import {
  etiquetaDiaMes,
  MENSAJE_CORRECCION_NO_SOPORTADA,
  MENSAJE_ERROR_GENERAL,
  MENSAJE_LIMITE_NUBE,
  MENSAJE_MESES_SIN_TARJETA,
  MENSAJE_MOVIMIENTO_COMPARTIDO,
  MENSAJE_NO_ENTENDI,
  mensajeError,
  type AccionElegir,
  type CompromisoConfigurado,
  type CuentaPorElegir,
  type EntradaMovimiento,
  type MotivoNoSoportado,
  type MotivoPorInterpretar,
  type ResultadoTexto,
  type ResumenMovimiento,
  type ResumenTransaccion,
} from '../../servicios';

/**
 * Redacción de las pantallas principales (02-UX §14): solo presentación de datos que ya calculó `servicios/`.
 */

export type TipoMovimiento = EntradaMovimiento['tipo'];

/** Nombres llanos de los movimientos que origina el usuario (sin términos contables). */
export const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Pasar entre mis cuentas',
  retiro_efectivo: 'Sacar efectivo',
  pago_tarjeta: 'Pagar tarjeta',
  prestamo_otorgado: 'Le presté a alguien',
  prestamo_recibido: 'Me prestaron',
  cobro_prestamo: 'Me pagaron lo que me debían',
  pago_prestamo: 'Pagué lo que debía',
};

/** Tipos de movimiento del libro que aparecen en Movimientos (incluye los que no origina el usuario). */
export const NOMBRE_TIPO_LIBRO: Record<string, string> = {
  ...NOMBRE_TIPO,
  ajuste_arqueo: 'Ajuste de efectivo',
  aportacion_tanda: 'Tanda',
  cobro_tanda: 'Cobro de tanda',
  cuenta_dividida: 'Cuenta dividida',
  reembolso: 'Reembolso',
};

export const NOMBRE_ORIGEN: Record<string, string> = {
  voz: 'Registrado por voz',
  texto: 'Registrado escribiendo',
  manual: 'Registrado a mano',
  notificacion: 'Capturado de una notificación',
  correo: 'Capturado de un correo',
  estado_cuenta: 'Leído de tu estado de cuenta',
  ticket: 'Leído de un ticket',
  arqueo: 'Registrado al contar tu efectivo',
  sistema: 'Registrado por la app',
};

export { MENSAJE_ERROR_GENERAL, MENSAJE_NO_ENTENDI, mensajeError };

/** Placeholder del campo «Escribir» en el panel (`02 §5.9`). */
export const EJEMPLO_CAMPO_REGISTRAR = 'tacos 80 en efectivo';

/** CTAs en tarjetas de consulta y explicar (`06 §6`, RF-CON-01 / RF-CON-02). */
export const BTN_VER_PLUS = 'Ver Plus';
/** Engrane en la cabecera de Cuentas (`02 §11`). */
export const BTN_AJUSTES_CUENTAS = '⚙ Ajustes';
/** TalkBack: sin emoji del engrane. */
export const BTN_AJUSTES_CUENTAS_ACCESIBLE = 'Ajustes';
/** Sección Debes en Cuentas (`02 §11`). */
export const BTN_AGREGAR_TARJETA_CREDITO = 'Agregar tarjeta de crédito';
/** TalkBack en Debes (`02 §11`, `02 §15`). */
export const PISTA_AGREGAR_TARJETA_CREDITO = 'Abre el formulario para registrar una tarjeta de crédito';
/** Te deben en Cuentas: abre la ficha (`02 §17`, `02 §15`). */
export const PISTA_COBRAR_DESDE_CUENTAS = 'Abre su ficha para cobrarle';
export const BTN_VER_MOVIMIENTOS = 'Ver movimientos';
export const BTN_VER_MOVIMIENTOS_CHEVRON = 'Ver movimientos ›';
export const BTN_LISTO = 'Listo';

export const MENSAJE_POR_INTERPRETAR =
  'Lo guardé; lo interpreto cuando tengas internet. Lo encuentras en Movimientos, en Por revisar.';

/** Por qué quedó guardada la frase (`02 §5`, punto 8). */
export const MENSAJE_GUARDADA: Record<MotivoPorInterpretar, string> = {
  sin_nube: MENSAJE_POR_INTERPRETAR,
  sin_red: MENSAJE_POR_INTERPRETAR,
  limite: MENSAJE_LIMITE_NUBE,
  error: 'No pude interpretarla en este momento. La guardé y lo intento de nuevo más tarde.',
};

export const MENSAJE_NO_SOPORTADO: Record<MotivoNoSoportado, string> = {
  tipo_movimiento: 'Todavía no registro ese tipo de movimiento hablando. Usa el formulario.',
  intencion: 'Eso todavía no lo hago. Llega pronto.',
  ajuste:
    'Eso todavía no lo configuro hablando. Tu ingreso y tu colchón los cambias en Ajustes; tus tarjetas, en Cuentas.',
  consulta: 'Todavía no sé responder esa pregunta.',
  meses_sin_tarjeta: MENSAJE_MESES_SIN_TARJETA,
  correccion: MENSAJE_CORRECCION_NO_SOPORTADA,
  movimiento_compartido: MENSAJE_MOVIMIENTO_COMPARTIDO,
};

type FueraDeAlcance = Extract<ResultadoTexto, { resultado: 'fuera_de_alcance' }>['motivo'];

export function mensajeFueraDeAlcance(motivo: FueraDeAlcance): string {
  if (motivo === 'mueve_dinero') return 'No muevo dinero por ti: solo llevo la cuenta de lo que pasa.';
  if (motivo === 'asesoria_inversion') return 'No doy recomendaciones de inversión.';
  return 'Eso no lo puedo hacer. Te ayudo con tus gastos, ingresos y pagos.';
}

/** Títulos de la tarjeta de confirmación de tanda por voz (TK02, `06 §7`). */
export const TITULO_CONFIRMAR_TANDA: Record<
  Extract<ResultadoTexto, { resultado: 'confirmar_tanda' }>['motivo'],
  string
> = {
  monto_alto: 'Es un monto alto. Revísalo antes de guardar.',
  tanda: '¿De cuál tanda hablas?',
  cuenta: 'Confirma la tanda y la cuenta.',
  aproximado: 'Confírmame la cuenta.',
};

export const PREGUNTA_CUENTA_TANDA = {
  aportacion: '¿De qué cuenta salió?',
  cobro: '¿A qué cuenta llegó?',
} as const;

/** Títulos de la tarjeta de confirmación al registrar (02-UX §5.3). */
export const TITULO_CONFIRMAR_REGISTRO: Record<
  Extract<ResultadoTexto, { resultado: 'confirmar' }>['motivo'],
  string
> = {
  monto_alto: 'Es un monto alto. Revísalo antes de guardar.',
  cuenta: 'Confirma la cuenta.',
  aproximado: 'Confírmame la cuenta.',
  impuestos: 'Es un gasto de impuestos. Revísalo antes de guardar.',
};

/** Leyenda de chips cuando falta elegir cuenta en la confirmación de registro. */
export function preguntaCuentaConfirmacionRegistro(f: CuentaPorElegir): string {
  if (f.motivo === 'no_encontrada' && f.alias) {
    return `No tengo una cuenta «${f.alias}». ¿Cuál fue?`;
  }
  if (f.motivo === 'aproximado' && f.alias) return `¿Con «${f.alias}» te refieres a esta?`;
  return f.campo === 'origenId' ? PREGUNTA_CUENTA_TANDA.aportacion : PREGUNTA_CUENTA_TANDA.cobro;
}

export const ETIQUETA_GUARDAR = 'Guardar';
export const ETIQUETA_CANCELAR = 'Cancelar';
export const ETIQUETA_BORRAR = 'Borrar';

/** Elegir movimiento, duplicados o aclarar (`06 §7`, `TarjetasInterpretacion`). */
export const TITULO_ELEGIR_MOVIMIENTO: Record<AccionElegir, string> = {
  corregir: '¿Cuál quieres corregir?',
  anular: '¿Cuál quieres borrar?',
  pasar_a_meses: '¿Cuál pasaste a meses?',
};

export function preguntaCuentaElegirMovimiento(falta: { motivo: string; alias?: string | null }): string {
  if (falta.motivo === 'no_encontrada' && falta.alias) {
    return `No tengo una cuenta «${falta.alias}». ¿Cuál fue?`;
  }
  return '¿Con qué cuenta fue?';
}

export function etiquetaBotonElegirMovimiento(accion: AccionElegir): string {
  return accion === 'anular' ? ETIQUETA_BORRAR : ETIQUETA_GUARDAR;
}

export const TITULO_DUPLICADOS = 'Estos se parecen. ¿Alguno está repetido?';
export const BTN_BORRAR_DUPLICADO = 'Borrar este';
export const BTN_DUPLICADOS_OK = 'Están bien';
export const TEXTO_ACLARAR_SIN_OPCIONES = 'Dímelo otra vez con ese dato.';
export const MOVIMIENTO_SIN_NOMBRE = 'Movimiento';

export const MENSAJE_NO_ENCONTRE = 'No encontré ese movimiento.';
export const MENSAJE_SIN_DUPLICADOS = 'No vi movimientos repetidos.';

/** "1 frase espera internet." — el indicador discreto del panel. */
export function mensajeEsperandoConexion(n: number): string {
  return n === 1
    ? '1 frase espera internet para interpretarla.'
    : `${n} frases esperan internet para interpretarlas.`;
}

/** "Corregí: Tacos $80 · Comida fuera · Cartera. Antes: Nu." */
export function mensajeCorregido(antes: ResumenTransaccion, despues: ResumenTransaccion): string {
  const cambios: string[] = [];
  if (antes.cuenta !== despues.cuenta) cambios.push(antes.porAsignar ? 'por asignar' : antes.cuenta);
  if (antes.monto !== despues.monto) cambios.push(formatearCentavos(antes.monto));
  if (antes.categoria !== despues.categoria && antes.categoria) cambios.push(antes.categoria);
  if (antes.fecha !== despues.fecha) cambios.push(etiquetaDiaMes(antes.fecha));
  const previo = cambios.length > 0 ? `. Antes: ${cambios.join(', ')}` : '';
  return `Corregí: ${resumenMovimiento(despues)}${previo}`;
}

export function mensajeAnulado(m: ResumenTransaccion): string {
  return `Borré: ${resumenMovimiento(m)}`;
}

/** "Listo: Renta $6,500. El próximo es el 1 nov." */
export function mensajeConfigurado(c: CompromisoConfigurado): string {
  const proximo = c.proxima ? `. El próximo es el ${etiquetaDiaMes(c.proxima)}` : '';
  return `Listo: ${c.concepto} ${formatearCentavos(c.monto)}${proximo}.`;
}

export function mensajePasarAMeses(m: ResumenTransaccion, meses: number): string {
  return `Anoté que ${(m.descripcion ?? 'la compra').toLowerCase()} va a ${meses} meses. Lo verás en tu tarjeta pronto.`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Coca $25 · Antojos · Efectivo" (02-UX §5). */
export function resumenMovimiento(m: ResumenMovimiento | ResumenTransaccion): string {
  const nombre = NOMBRE_TIPO_LIBRO[m.tipo] ?? 'Movimiento';
  const partes = [`${capitalizar(m.descripcion ?? nombre.toLowerCase())} ${formatearCentavos(m.monto)}`];
  if (m.categoria) partes.push(m.categoria);
  partes.push(m.porAsignar ? 'por asignar' : m.cuenta);
  return partes.join(' · ');
}

/** "Registré: Coca $25 · Antojos · Efectivo". */
export function mensajeRegistrado(movimientos: readonly ResumenMovimiento[]): string {
  return `Registré: ${movimientos.map(resumenMovimiento).join('; ')}`;
}

/** Código de un error de dominio, o `null` si es otro error. */
export function codigoError(e: unknown): string | null {
  return e instanceof ErrorDominio ? e.codigo : null;
}

/** "dom 11" + "11 oct" → "Dom 11 oct". */
export function encabezadoFecha(diaSemana: string, diaMes: string): string {
  const mes = diaMes.split(' ')[1] ?? '';
  return capitalizar(`${diaSemana} ${mes}`.trim());
}

/** Héroe de Hoy (`02 §4`, `02 §4.2`): título, subtítulo y contexto de TalkBack de la cifra. */
export const TITULO_HOY_PUEDES_GASTAR = 'Hoy puedes gastar';
export const TITULO_HOY_LIBRE_NEGATIVO = 'Hoy:';
export const CONTEXTO_CIFRA_HOY_PUEDES = TITULO_HOY_PUEDES_GASTAR;
/** "Hoy: $0" en libre negativo; no decir "puedes gastar" cuando la cifra es cero por faltante. */
export const CONTEXTO_CIFRA_LIBRE_NEGATIVO = 'Hoy';
export const TITULO_SIN_INGRESO = 'Dime cada cuándo te pagan';
export const SUBTITULO_SIN_INGRESO =
  'Así reparto tu dinero libre hasta el próximo pago.';

/** Plus: tip del día en Hoy (`02 §4`). */
export const TITULO_TARJETA_DEL_DIA = 'Tarjeta del día';

/** TalkBack de la tarjeta del día: título + tip en una sola frase. */
export function etiquetaTarjetaDelDia(texto: string): string {
  return `${TITULO_TARJETA_DEL_DIA}. ${texto}`;
}

/** Indicador mientras se calcula la probabilidad en Hoy (`02 §15`). */
export const ETIQUETA_PROBABILIDAD_CALCULANDO = 'Calculando si llegas…';

/** TalkBack en la barra de probabilidad: la marca vertical es P = 50 % (`02 §13`). */
export const FRASE_MARCA_PROBABILIDAD = 'La marca es el 50 %.';

/** Aviso bajo la probabilidad cuando P < 50 % (`02 §13`): sin cifras nuevas. */
export const TEXTO_AVISO_RIESGO_HOY =
  'Con lo que sueles gastar, es probable que tengas que tocar tu colchón antes de tu próximo ingreso. Revisa qué viene.';

/** Alias usado en pruebas de pantalla y servicios de aviso. */
export const TEXTO_RIESGO = TEXTO_AVISO_RIESGO_HOY;

/** Prefijo TalkBack del aviso bajo la probabilidad cuando P < 50 % (`02 §13`, `02 §15`). */
export const ETIQUETA_AVISO_RIESGO = 'Aviso de riesgo';

export function etiquetaAvisoRiesgo(cuerpo: string = TEXTO_AVISO_RIESGO_HOY): string {
  return `${ETIQUETA_AVISO_RIESGO}. ${cuerpo}`;
}

export { PISTA_CONFIGURAR_INGRESO as PISTA_CONFIGURAR_INGRESO_HOY } from '../ajustes/ingreso-textos';

/** TalkBack en CTAs de Hoy (`02 §15`). */
export const PISTA_VER_DESGLOSE = 'Muestra efectivo, reservado, colchón y libre';
export const PISTA_OCULTAR_DESGLOSE = 'Oculta el desglose de tu dinero';
export const PISTA_VER_QUE_VIENE = 'Muestra lo que viene antes de tu próximo ingreso';
export const PISTA_CONTAR_EFECTIVO = 'Abre el arqueo para contar el efectivo que traes';
export const PISTA_AVISO_ENTENDIDO = 'Oculta este aviso';
export const PISTA_ME_ALCANZA_HOY = 'Calcula si te alcanza para una compra';

// ——— Modo explicar (`02 §22`) ———

export const MENSAJE_EXPLICANDO = 'Revisando tus datos…';
export const MENSAJE_EXPLICAR_SIN_RED =
  'Necesito internet para responderte eso. Pregúntame de nuevo cuando tengas conexión.';
export const MENSAJE_EXPLICAR_ERROR = 'No pude responderte ahora. Pregúntame de nuevo en un rato.';
export const MENSAJE_EXPLICAR_SOLO_PLUS =
  'Preguntarme lo que quieras sobre tu dinero es parte de Plus. Tu «hoy puedes» sigue en tu plan.';

/** TalkBack: errores de explicar y cupo del intérprete en el panel (`CA-M7-02`). */
const MENSAJES_REGISTRO_ALERTA = new Set([
  MENSAJE_EXPLICAR_ERROR,
  MENSAJE_EXPLICAR_SIN_RED,
  MENSAJE_LIMITE_NUBE,
  MENSAJE_LIMITE_MENSUAL_GRATIS,
  MENSAJE_LIMITE_MENSUAL_PLUS,
  MENSAJE_LIMITE_DIARIO,
]);

export function esMensajeRegistroAlerta(mensaje: string): boolean {
  return MENSAJES_REGISTRO_ALERTA.has(mensaje);
}

// ——— Movimientos (`02 §10`) ———

/** Lista vacía (sin filtro). */
export const TEXTO_MOVIMIENTOS_VACIO =
  'Todavía no hay movimientos. Ve a Hoy y di o escribe algo como «tacos 80 en efectivo».';

/** Consulta filtrada sin resultados (`06 §6`). */
export const TEXTO_MOVIMIENTOS_FILTRO_VACIO = 'No hay movimientos que coincidan.';

export const TITULO_POR_REVISAR = 'Por revisar';
export const TEXTO_POR_REVISAR =
  'Las interpreto cuando tengas internet. Si ya lo registraste a mano, descártala.';
export const TEXTO_MOVIMIENTOS_FILTRO_ACTIVO = 'Solo los movimientos de tu pregunta.';

/** CTA «Registrar» en la pestaña Movimientos (`02 §15`). */
export const PISTA_REGISTRAR_MOVIMIENTO = 'Abre el formulario para registrar un gasto o ingreso';

/** Quita el filtro de una consulta en Movimientos (`06 §6`, TalkBack). */
export const PISTA_VER_TODOS_MOVIMIENTOS = 'Quita el filtro y muestra todos tus movimientos';

/** TalkBack: título de sección + intro cuando hay frases pendientes (`02 §10`, `02 §15`). */
export function etiquetaIntroPorRevisar(): string {
  return `${TITULO_POR_REVISAR}. ${TEXTO_POR_REVISAR}`;
}

/** Frase en cola «Por revisar» (`02 §10`, TalkBack). */
export const PISTA_REVISAR_FRASE = 'Abre el formulario para confirmar este registro';

/** Descartar frase en «Por revisar» (`02 §10`, TalkBack). */
export const PISTA_DESCARTAR_FRASE = 'Elimina esta frase de la cola por revisar';

/** Filtro de consulta activo en Movimientos (`06 §6`, TalkBack). */
export function etiquetaFiltroMovimientosActivo(): string {
  return `Movimientos. ${TEXTO_MOVIMIENTOS_FILTRO_ACTIVO}`;
}

/** Encabezado de día en la lista de movimientos (`02 §10`, TalkBack). */
export function etiquetaEncabezadoDiaMovimientos(etiquetaVisible: string): string {
  return etiquetaHablada(`Movimientos del ${etiquetaVisible}`);
}

/** Lista vacía en Movimientos: pestaña + copy para TalkBack (`02 §15`). */
export function etiquetaVacioMovimientos(conFiltro: boolean): string {
  const copy = conFiltro ? TEXTO_MOVIMIENTOS_FILTRO_VACIO : TEXTO_MOVIMIENTOS_VACIO;
  return `Movimientos. ${copy}`;
}

export const PREGUNTA_PASAR_A_MESES = '¿A cuántos meses sin intereses fue?';
export const PISTA_ELEGIR_CUENTA_CONFIRMACION = 'Elige una cuenta en los chips de arriba.';
export const MENSAJE_ANULADO_MOVIMIENTO = 'Anulé el movimiento.';

/** Fila de movimiento expandible (`02 §10`, TalkBack). */
export const PISTA_MOSTRAR_DETALLE_MOVIMIENTO = 'Muestra el detalle';
export const PISTA_OCULTAR_DETALLE_MOVIMIENTO = 'Oculta el detalle';

/** Anular desde el detalle (`02 §10`, TalkBack). */
export const TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO =
  '¿Anular este movimiento? Sus montos vuelven a tus cuentas.';
export const PISTA_ANULAR_MOVIMIENTO = 'Pide confirmación para anular este movimiento';
export const PISTA_CONFIRMAR_ANULAR_MOVIMIENTO =
  'Anula el movimiento y devuelve los montos a tus cuentas';

export function etiquetaConfirmarAnularMovimiento(): string {
  return etiquetaHablada(TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO);
}

// ——— Cuentas (`02 §11`) ———

/** Tienes: sin efectivo, débito, billetera ni ahorro. */
export const TEXTO_CUENTAS_TIENES_VACIO =
  'Todavía no tienes cuentas de efectivo, débito ni ahorro. Agrégalas al configurar la app o cuando captures un movimiento.';

/** Debes: sin tarjetas ni deudas con personas. */
export const TEXTO_CUENTAS_DEBES_VACIO = 'No debes nada en tarjetas ni préstamos con personas.';

/** Compromisos: nada en los próximos 30 días. */
export const TEXTO_CUENTAS_COMPROMISOS_VACIO = 'No tienes pagos en los próximos 30 días.';

export const SUBTITULO_CUENTAS_COMPROMISOS = 'Próximos 30 días';

/** Vacíos de Cuentas: sección + copy para TalkBack (`02 §15`). */
export function etiquetaVacioCuentasTienes(): string {
  return `Tienes. ${TEXTO_CUENTAS_TIENES_VACIO}`;
}

export function etiquetaVacioCuentasDebes(): string {
  return `Debes. ${TEXTO_CUENTAS_DEBES_VACIO}`;
}

export function etiquetaVacioCuentasCompromisos(): string {
  return `Compromisos, ${SUBTITULO_CUENTAS_COMPROMISOS.toLowerCase()}. ${TEXTO_CUENTAS_COMPROMISOS_VACIO}`;
}

/** Contexto TalkBack de cada saldo en Cuentas (`02 §15`). */
export function contextoSaldoTienes(nombre: string): string {
  return `En ${nombre} tienes`;
}

export function contextoSaldoTeDebe(nombre: string): string {
  return `${nombre} te debe`;
}

export function contextoSaldoTarjeta(nombre: string, aFavor: boolean): string {
  return aFavor ? `Saldo a favor en ${nombre}` : `Debes en ${nombre}`;
}

export function contextoSaldoLeDebes(nombre: string): string {
  return `Le debes a ${nombre}`;
}

export function contextoSaldoCompromiso(concepto: string, fechaEtiqueta: string): string {
  return `Pago de ${concepto} el ${fechaEtiqueta}`;
}
