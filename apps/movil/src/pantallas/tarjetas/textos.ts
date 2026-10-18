import {
  etiquetaDiaMes,
  type CompraMsiRegistrada,
  type ResultadoTexto,
  type TarjetaEditada,
} from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Redacción de Tarjetas (`02 §8`, `02 §14`): solo presenta lo que ya calculó `servicios/`. */

/** `'2026-11'` → "nov 2026". */
export function etiquetaMes(mes: string): string {
  const abreviado = etiquetaDiaMes(`${mes}-01`).split(' ')[1] ?? mes;
  return `${abreviado} ${mes.slice(0, 4)}`;
}

/** "12 meses de $1,000" (o "11 de $1,000 y 1 de $1,000.50" si la última cuota absorbe el residuo). */
export function lineaCuotas(c: Pick<CompraMsiRegistrada, 'meses' | 'cuotas'>): string {
  const grupos = new Map<number, number>();
  for (const q of c.cuotas) grupos.set(q.monto, (grupos.get(q.monto) ?? 0) + 1);
  const partes = [...grupos.entries()].map(([monto, n]) => `${n} de ${formatearCentavos(monto)}`);
  if (partes.length === 1) return `${c.meses} meses de ${formatearCentavos(c.cuotas[0]?.monto ?? 0)}`;
  return `${c.meses} meses: ${partes.join(' y ')}`;
}

/** "Registré: Tele $12,000 a 12 meses sin intereses · Banamex Oro ••8812" + "12 meses de $1,000". */
export function mensajeCompraMsi(c: CompraMsiRegistrada): string {
  const que = c.descripcion.charAt(0).toUpperCase() + c.descripcion.slice(1);
  return `Registré: ${que} ${formatearCentavos(c.monto)} a ${c.meses} meses sin intereses · ${c.tarjeta}\n${lineaCuotas(c)}`;
}

function cicloEnPalabras(ciclo: TarjetaEditada['ciclo']): string {
  const pago =
    ciclo.diaLimitePago !== undefined
      ? `pagas el ${ciclo.diaLimitePago}`
      : `tienes ${ciclo.diasParaPagar ?? 0} días para pagar`;
  return `corta el ${ciclo.diaCorte} y ${pago}`;
}

/** "Listo: tu Nu ••4410 corta el 28 y pagas el 18." */
export function mensajeTarjetaConfigurada(tarjeta: string, editada: TarjetaEditada): string {
  return `Listo: tu ${tarjeta} ${cicloEnPalabras(editada.ciclo)}.`;
}

/** "Registré: pago a tu Nu ••4410 $2,000". */
export function mensajePagoTarjeta(tarjeta: string, monto: number): string {
  return `Registré: pago a tu ${tarjeta} ${formatearCentavos(monto)}`;
}

export const NOMBRE_MODO = {
  totalero: 'La pago completa cada mes',
  plan: 'Voy pagando por partes',
} as const;

export const VACIO_MSI_TARJETA = 'No tienes compras a meses en esta tarjeta.';

export const NOMBRE_ESTADO_PLAN = {
  activo: 'Activo',
  terminado: 'Ya pagaste todas las cuotas',
  liquidado: 'Ya lo terminaste de pagar',
} as const;

/** Detalle `/tarjetas/[id]` (`02 §8`): navegación, resumen, movimientos, estados y configuración. */

export const BTN_VOLVER = 'Volver';
export const TEXTO_TARJETA_NO_ENCONTRADA = 'No encontré esa tarjeta.';
export const TITULO_PAGAR_TARJETA = 'Pagar tarjeta';
export const BTN_PAGAR = 'Pagar';
export const CANDADO_COMPROMISO_12_MESES = 'Ver tus meses de los próximos 12 meses';
export const TITULO_DESDE_ULTIMO_CORTE = 'Desde tu último corte';
export const TITULO_DESDE_ALTA = 'Desde que la agregaste';
export const VACIO_MOVIMIENTOS_TARJETA = 'Sin compras ni pagos todavía.';
export const MOVIMIENTO_SIN_TITULO = 'Movimiento';
export const TITULO_ESTADOS_CUENTA = 'Estados de cuenta';
export const BTN_LEER_PDF_BANCO = 'Leer el PDF de tu banco';
export const TITULO_CONFIGURACION = 'Configuración';
export const BTN_EDITAR_TARJETA = 'Editar tarjeta';
export const BTN_CORREGIR_SALDO = 'Corregir saldo';
export const MENSAJE_SALDO_SIN_CAMBIO = 'Ese ya era el saldo. No cambié nada.';

/** Editar tarjeta y corregir saldo (`02 §8`). */
export const BTN_GUARDAR_CAMBIOS = 'Guardar cambios';
export const ETIQUETA_NOMBRE_TARJETA = 'Nombre';
export const ETIQUETA_ULTIMOS4 = 'Últimos 4 números (opcional)';
export const ETIQUETA_DIA_CORTE = 'Día de corte';
export const PREGUNTA_MODO_LIMITE = '¿Cómo sabes cuándo pagar?';
export const OPCION_LIMITE_DIA_MES = 'Un día del mes';
export const OPCION_LIMITE_DIAS_DESPUES = 'Días después del corte';
export const ETIQUETA_DIA_LIMITE_PAGO = 'Día límite de pago';
export const ETIQUETA_DIAS_PARA_PAGAR = 'Días para pagar después del corte';
export const ETIQUETA_LIMITE_CREDITO = 'Límite de crédito';
export const PREGUNTA_MODO_PAGO = '¿Cómo la pagas?';
export const ETIQUETA_TASA_ANUAL = 'Tasa anual (opcional)';
export const AYUDA_TASA_ANUAL = 'Solo la uso para decirte qué tarjeta conviene pagar primero.';
export const EJEMPLO_TASA_ANUAL = '45.5';
export const ERROR_NOMBRE_TARJETA = 'Escribe el nombre de la tarjeta.';
export const ERROR_ULTIMOS4_TARJETA = 'Los últimos 4 son cuatro números, o déjalo vacío.';
export const ERROR_DIA_CORTE = 'Escribe el día de corte, del 1 al 31.';
export const ERROR_DIA_LIMITE_PAGO = 'Escribe el día límite de pago, del 1 al 31.';
export const ERROR_DIAS_PARA_PAGAR = 'Escribe cuántos días tienes para pagar después del corte.';
export const ERROR_LIMITE_CREDITO = 'Escribe tu límite de crédito.';
export const ERROR_TASA_ANUAL = 'Escribe la tasa así: 45.5';
export const ERROR_GUARDAR_TARJETA = 'No pude guardar la tarjeta. Revisa el día de corte y el día límite.';
export const ETIQUETA_SENTIDO_DEBO = 'Debo';
export const ETIQUETA_SENTIDO_A_FAVOR = 'Tengo saldo a favor';
export const ETIQUETA_SALDO_SEGUN_BANCO = 'Saldo según tu banco';
export const ERROR_SALDO_SEGUN_BANCO = 'Escribe el saldo que dice tu banco.';
export const ERROR_CORREGIR_SALDO = 'No pude corregir el saldo. Intenta de nuevo.';

export function textoPrimerCorteEnApp(etiquetaProximoCorte: string): string {
  return `Tu primer corte con la app es el ${etiquetaProximoCorte}.`;
}

export const ETIQUETA_DEBES = 'Debes';
export function textoDeudaMeses(monto: string): string {
  return `De eso, ${monto} son meses sin intereses.`;
}
export const ETIQUETA_SALDO_A_FAVOR = 'Saldo a favor';
export const AYUDA_SALDO_A_FAVOR =
  'No se suma a tu dinero libre: se usa en tus próximas compras con esta tarjeta.';
export const ETIQUETA_PNGI = 'Para no generar intereses';
export function textoPagarPngiAntesDe(fechaLimite: string): string {
  return `Págalo a más tardar el ${fechaLimite}.`;
}
export const TEXTO_PNGI_CUBIERTO = 'Ya cubriste el pago de tu último corte.';
export function textoSinCorteDesdeAlta(etiquetaProximoCorte: string): string {
  return `Aún no cierra ningún corte desde que la agregaste. El primero es el ${etiquetaProximoCorte}.`;
}
export const ETIQUETA_FECHA_LIMITE = 'Fecha límite';
export const ETIQUETA_PROXIMO_CORTE = 'Próximo corte';
export const ETIQUETA_DISPONIBLE = 'Disponible';

export function etiquetaAccesibleUsoTarjeta(porcentaje: number): string {
  return `Usas ${porcentaje} % de tu límite`;
}
export function textoUsoLimiteTarjeta(porcentaje: number, limite: string): string {
  return `Usas ${porcentaje} % de tu límite de ${limite}. La marca es el 30 %.`;
}

/** "Corta el 10 y pagas el 20." — resumen en configuración (no el formulario de edición). */
export function textoCicloTarjeta(ciclo: TarjetaEditada['ciclo']): string {
  const pago =
    ciclo.diaLimitePago !== undefined
      ? `pagas el ${ciclo.diaLimitePago}`
      : `tienes ${ciclo.diasParaPagar ?? 0} días para pagar`;
  return `Corta el ${ciclo.diaCorte} y ${pago}.`;
}

export function tituloEstadoCuenta(fechaCorte: string): string {
  return `Corte del ${fechaCorte}`;
}
export const ETIQUETA_SALDO_FAVOR_AL_CORTE = 'Saldo a favor al corte';
export const ETIQUETA_DEBIAS_DIA_CORTE = 'Lo que debías el día de corte';
export const ETIQUETA_PAGADO_DESDE_CORTE = 'Lo que ya pagaste desde entonces';
export function etiquetaSaldoAlCorte(saldoCorte: number): string {
  return saldoCorte < 0 ? ETIQUETA_SALDO_FAVOR_AL_CORTE : ETIQUETA_DEBIAS_DIA_CORTE;
}
export function textoFechaLimiteEstado(fechaLimite: string): string {
  return `Fecha límite: ${fechaLimite}`;
}

/** Meses sin intereses y pagos planeados (`02 §8`). */
export const TITULO_MESES_SIN_INTERESES = 'Meses sin intereses';
export const TITULO_COMPROMISO_MSI = 'Lo que pagarás en meses sin intereses';
export const SUBTITULO_COMPROMISO_MSI = 'Próximos 12 meses, por mes de fecha límite';
export const TITULO_PAGOS_PLANEADOS = 'Pagos planeados';

/** Confirmación de compra a meses por voz (CA-M4-06). */
export const TITULO_CONFIRMAR_MSI: Record<
  Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>['motivo'],
  string
> = {
  monto_alto: 'Es un monto alto. Revísalo antes de guardar.',
  cuenta: '¿Con qué tarjeta fue?',
  aproximado: 'Confírmame la tarjeta.',
};

export function tituloCompraMsiMeses(meses: number): string {
  return `Compra a ${meses} meses sin intereses`;
}

export const APOYO_CONFIRMAR_MSI =
  'La compra cuenta completa como gasto hoy; cada mes aparto solo la mensualidad.';

export function preguntaTarjetaConfirmarMsi(falta: {
  motivo: string;
  alias?: string | null;
}): string {
  if (falta.motivo === 'no_encontrada' && falta.alias) {
    return `No tengo una tarjeta «${falta.alias}». ¿Con cuál fue?`;
  }
  return TITULO_CONFIRMAR_MSI.cuenta;
}

export const PREGUNTA_CATEGORIA_MSI = '¿En qué categoría va?';
export const ETIQUETA_DESCRIPCION_MSI = '¿Qué compraste? (opcional)';
export const EJEMPLO_DESCRIPCION_MSI = 'tele';
export const BTN_GUARDAR_MSI = 'Guardar';

export function subtituloPagosPlaneados(conPagos: boolean): string {
  return conPagos
    ? 'Aparto solo los pagos que vencen antes de tu próximo ingreso.'
    : 'Sin pagos planeados aparto lo que debes completo.';
}

export function textoConfirmarLiquidar(descripcion: string, restante: string): string {
  return `¿Liquidar ${descripcion}? Lo que falta, ${restante}, pasa a tu próximo pago de la tarjeta.`;
}

export function mensajeLiquidacionPlan(descripcion: string, monto: string): string {
  return `Listo: liquidaste ${descripcion} (${monto}).`;
}

export const BTN_SI_LIQUIDAR = 'Sí, liquidar';
export const BTN_LIQUIDAR_MESES = 'Liquidar meses';
export const BTN_GUARDAR_PAGO_PLANEADO = 'Guardar pago planeado';
export const ERROR_MONTO_PAGO_PLANEADO = 'Escribe cuánto vas a pagar cada vez.';
export const ERROR_DIA_PAGO_PLANEADO = 'Escribe el día del mes, del 1 al 31.';

/** Formulario "Pagar tarjeta" y pregunta de liquidar meses. */
export const ETIQUETA_MONTO_PAGO = '¿Cuánto pagaste?';
export const PREGUNTA_CUENTA_PAGO = '¿De qué cuenta salió?';
export const ERROR_MONTO_PAGO = 'Escribe cuánto pagaste.';
export const ERROR_ORIGEN_PAGO = 'Elige de qué cuenta salió el pago.';
export const BTN_GUARDAR_PAGO = 'Guardar pago';
export const BTN_CANCELAR = 'Cancelar';
export const BTN_NO = 'No';

export function textoSaldoAFavorTrasPago(tarjeta: string, monto: string): string {
  return `Tu ${tarjeta} quedó con saldo a favor de ${monto}. No lo sumo a tu dinero libre.`;
}

export const AVISO_SALDO_A_FAVOR_EN_TARJETA = 'Va. El saldo a favor se queda en tu tarjeta.';

export function etiquetaSiLiquidar(descripcion: string): string {
  return `Sí, ${descripcion}`;
}

/** TalkBack: fila etiqueta + valor en el resumen. */
export function etiquetaAccesibleDato(etiqueta: string, valor: string): string {
  return `${etiqueta}: ${valor}`;
}
