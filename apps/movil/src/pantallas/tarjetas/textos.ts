import { etiquetaDiaMes, type CompraMsiRegistrada, type TarjetaEditada } from '../../servicios';
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
