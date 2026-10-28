import type { Centavos, PlainDate } from '@cartera/core';
import { etiquetaDiaMes, etiquetaFecha } from '../../servicios/formato';
import { formatearCentavos, leerPesos } from '../../ui/formato';
import type { CambioDia } from '../tipos';

/**
 * Redacción de los flujos conversacionales (Ola 7 §6, `02 §14`): es-MX, tuteo, sin exclamaciones ni consejos,
 * cada turno en dos líneas como mucho. Las cifras llegan ya calculadas por servicios o `core` (regla 4).
 */

const $ = (c: Centavos): string => formatearCentavos(c);

/** "jue 26 nov". */
export function fechaCorta(f: PlainDate): string {
  const mes = etiquetaDiaMes(f).split(' ')[1] ?? '';
  return `${etiquetaFecha(f)} ${mes}`.trim();
}

// ——— Comunes ———

export const CAMBIAR_ALGO = 'Cambiar algo';
export const CHIP_SI = 'Sí';
export const CHIP_NO = 'No';
export const ERROR_MONTO = 'No entendí la cantidad. Dímela otra vez o escríbela.';
export const ERROR_MONTO_CERO = 'Dime una cantidad mayor a cero.';
export const ERROR_ELEGIR = 'No entendí. Toca una de las opciones.';
export const ERROR_FECHA = 'No entendí la fecha. Toca una o dímela como «el 15».';
export const ERROR_PASO = 'Ese paso ya no aplica.';

export function lineaCambioDia(antes: string, despues: string): string {
  return `Tu día pasa de ${antes} a ${despues}.`;
}

/**
 * Las dos cifras de `lineaCambioDia` de vuelta en centavos, con la diferencia (B+, D3: «Tu día $275 → $268» y el
 * «−$7»). Son las mismas que calculó `core` para la frase; `null` si el texto no tiene esa forma.
 */
export function leerCambioDia(texto: string): CambioDia | null {
  const m = /^Tu día pasa de (\$[\d,]+(?:\.\d{2})?) a (\$[\d,]+(?:\.\d{2})?)\.$/.exec(texto);
  const antes = m?.[1] ? leerPesos(m[1]) : null;
  const despues = m?.[2] ? leerPesos(m[2]) : null;
  return antes === null || despues === null ? null : { antes, despues, delta: despues - antes };
}

// ——— Tarjeta ———

export const PREGUNTA_NOMBRE_TARJETA = '¿Cómo se llama la tarjeta?';
export const AYUDA_NOMBRE_TARJETA = 'El banco o como le dices: Nu, Oro, Costco.';
export const ERROR_NOMBRE_TARJETA = 'Dime cómo se llama la tarjeta.';
export const preguntaCorte = (nombre: string): string => `¿Qué día corta la ${nombre}?`;
export const AYUDA_CORTE = 'El día del mes en que cierra tu estado de cuenta.';
export const ERROR_CORTE = 'Dime el día de corte, del 1 al 31.';
export const preguntaPagoTarjeta = (nombre: string): string => `¿Qué día pagas la ${nombre}?`;
export const AYUDA_PAGO_TARJETA =
  'Tu fecha límite de pago. También puedes decir «20 días después del corte».';
export const ERROR_PAGO_TARJETA = 'Dime el día límite, del 1 al 31, o cuántos días te dan después del corte.';
export const preguntaSaldoTarjeta = (nombre: string): string => `¿Cuánto debes hoy en la ${nombre}?`;
export const AYUDA_SALDO_TARJETA = 'Tu saldo actual, no el pago mínimo.';
export const CHIP_NO_DEBO = 'No debo nada';
export const PREGUNTA_MODO = '¿La pagas completa cada mes?';
export const CHIP_COMPLETA = 'Sí, completa';
export const CHIP_UNA_PARTE = 'No, una parte';
export const PREGUNTA_INCLUYE_MSI = '¿Lo que debes ya incluye lo que te falta de esos meses?';
export const CHIP_INCLUYE = 'Sí, ya lo incluye';
export const CHIP_NO_SE = 'No sé';
export const TITULO_AGREGAR = 'Entendí · ¿la agrego?';
export const CONFIRMAR_AGREGAR = 'Sí, agrégala';
export const ETIQUETA_TARJETA = 'Tarjeta';
export const valorTarjeta = (nombre: string): string => `${nombre} · crédito`;
export const ETIQUETA_CICLO = 'Ciclo';
export function valorCiclo(corte: number, limite: number | null, dias: number | null): string {
  const pago = limite !== null ? `pagas el ${limite}` : `pagas ${dias ?? 0} días después`;
  return `corta el ${corte} · ${pago}`;
}
export const ETIQUETA_DEBES_HOY = 'Debes hoy';
export const valorDebes = (saldo: Centavos, aproximado: boolean): string =>
  aproximado ? `como ${$(saldo)}` : $(saldo);
export const ETIQUETA_MODO = 'Cómo la pagas';
export const MODO_TOTALERO = 'La pagas completa';
export const MODO_PLAN = 'Pagas una parte';
export const ETIQUETA_LIMITE = 'Límite';
export const ETIQUETA_MESES_PREVIOS = 'Meses que ya tenías';
export const valorMesesPrevios = (n: number): string =>
  n === 1 ? '1 compra a meses' : `${n} compras a meses`;
export const ETIQUETA_INCLUYE = 'Lo que debes ya los incluye';
export const mensajeTarjetaAgregada = (nombre: string): string => `Listo: agregué tu ${nombre}.`;

// ——— Compra a meses ———

export const PREGUNTA_TARJETA_MSI = '¿Con cuál tarjeta fue?';
export const preguntaTarjetaNoEncontrada = (alias: string): string =>
  `No tengo una tarjeta «${alias}». ¿Con cuál fue?`;
export const SIN_TARJETAS_MSI = 'Para registrar una compra a meses primero agrega tu tarjeta en Cuentas.';
export const TITULO_REGISTRAR = 'Entendí · ¿lo registro?';
export const CONFIRMAR_REGISTRAR = 'Sí, regístralo';
export const ETIQUETA_QUE = 'Qué';
export const ETIQUETA_MESES = 'Meses';
export const valorMeses = (n: number): string => `${n} meses`;
export const ETIQUETA_CADA_MES = 'Cada mes';
/** "$1,000" o, si la primera lleva el centavo de más (E6.1), "$1,000.09 la primera, luego $1,000.08". */
export function valorMensualidad(primera: Centavos, resto: Centavos, conMas: number): string {
  if (primera === resto) return $(primera);
  return conMas === 1
    ? `${$(primera)} la primera, luego ${$(resto)}`
    : `${$(primera)} las primeras ${conMas}, luego ${$(resto)}`;
}
export const ETIQUETA_PRIMER_PAGO = 'Primer pago';
export const ETIQUETA_CUANDO = 'Cuándo';
export const mensajeMsi = (que: string, monto: Centavos, meses: number, tarjeta: string): string =>
  `Registré ${que} ${$(monto)} a ${meses} meses con tu ${tarjeta}.`;
export const detallePrimerPago = (fecha: PlainDate): string =>
  `El primer pago vence el ${fechaCorta(fecha)}.`;

// ——— Tanda ———

export const PREGUNTA_APORTACION = '¿Cuánto das en cada ronda?';
export const PREGUNTA_FRECUENCIA = '¿Cada cuándo das?';
export const FRECUENCIAS_TANDA_TEXTO = {
  semanal: 'Cada semana',
  quincenal: 'Cada quincena',
  catorcenal: 'Cada 14 días',
  mensual: 'Cada mes',
} as const;
export const PREGUNTA_PARTICIPANTES = '¿Cuántos son en la tanda?';
export const AYUDA_PARTICIPANTES = 'Contándote a ti.';
export const ERROR_PARTICIPANTES = 'Dime cuántos son, de 2 a 50.';
export const PREGUNTA_TURNO = '¿Qué número te toca?';
export const ayudaTurno = (n: number): string => `Del 1 al ${n}.`;
export const errorTurno = (n: number): string => `Tu turno va del 1 al ${n}.`;
export const etiquetaChipTurno = (k: number): string => `El ${k}`;
export const PREGUNTA_INICIO = '¿Cuándo es la primera ronda?';
export const etiquetaChipFecha = (f: PlainDate, hoy: PlainDate): string =>
  f === hoy ? `Hoy · ${etiquetaDiaMes(f)}` : fechaCorta(f);
export const ETIQUETA_FRECUENCIA = 'Cada cuándo';
export const ETIQUETA_DAS = 'Das';
export const valorDas = (aportacion: Centavos, cada: string): string =>
  `${$(aportacion)} ${cada.toLowerCase()}`;
export const ETIQUETA_SON = 'Son';
export const valorSon = (n: number): string => `${n} personas`;
export const ETIQUETA_TURNO = 'Tu turno';
export const ETIQUETA_COBRAS = 'Cobras';
export const valorCobras = (cobro: Centavos, fecha: PlainDate): string =>
  `${$(cobro)} el ${fechaCorta(fecha)}`;
export const ETIQUETA_PRIMERA_RONDA = 'Primera ronda';
export const ETIQUETA_LLEVAS = 'Llevas';
export const valorLlevas = (n: number): string => (n === 1 ? '1 aportación' : `${n} aportaciones`);
export const ETIQUETA_YA_COBRASTE = '¿Ya cobraste?';
export const CHIP_TODAVIA_NO = 'Todavía no';
export const MENSAJE_TANDA = 'Listo: agregué tu tanda.';
export const detalleTanda = (cobro: Centavos, fecha: PlainDate): string =>
  `Cobras ${$(cobro)} el ${fechaCorta(fecha)}.`;

// ——— Cuenta dividida ———

export const PREGUNTA_PARTES = '¿Entre cuántos fue, contándote?';
export const errorPartes = (minimo: number): string => `Dime entre cuántos fue, de ${minimo} a 50.`;
export const PREGUNTA_PAGASTE_CON = '¿Con qué pagaste?';
export const preguntaCuentaNoEncontrada = (alias: string): string =>
  `No tengo una cuenta «${alias}». ¿Con cuál pagaste?`;
export const preguntaPersona = (faltan: number): string =>
  faltan === 1 ? '¿Con quién más fue?' : `¿Con quién fue? Faltan ${faltan}.`;
export const AYUDA_PERSONA = 'Toca a alguien o dime su nombre.';
export const preguntaQuienEs = (nombre: string): string => `¿Quién es «${nombre}»?`;
export const chipAlguienNuevo = (nombre: string): string => `Otra persona: ${nombre}`;
export const ERROR_PERSONA = 'Dime un nombre o toca a alguien.';
export const ETIQUETA_ENTRE = 'Entre';
export const valorEntre = (partes: number): string => `${partes}, contándote`;
export const ETIQUETA_TU_PARTE = 'Tu parte';
export const valorTeDebe = (monto: Centavos, nueva: boolean): string =>
  nueva ? `te debe ${$(monto)} · contacto nuevo` : `te debe ${$(monto)}`;
export const ETIQUETA_PAGASTE_CON = 'Pagaste con';
export const TODAVIA_NO_SE = 'Todavía no sé';
export const mensajeDivision = (que: string, total: Centavos, partes: number): string =>
  `Registré ${que} ${$(total)} entre ${partes}.`;
export const detalleTeDeben = (monto: Centavos): string => `Te deben ${$(monto)}.`;

// ——— Arqueo ———

export const SIN_EFECTIVO = 'No llevas una cuenta de efectivo. Agrégala en Cuentas para poder contarla.';
export const preguntaEfectivo = (esperado: Centavos): string =>
  `¿Cuánto efectivo traes? Deberías traer ${$(esperado)}.`;
export const chipTraigo = (monto: Centavos): string => `Traigo ${$(monto)}`;
export const preguntaPorAsignar = (descripcion: string, monto: Centavos, etiqueta: string): string =>
  `¿Pagaste ${descripcion} ${$(monto)} (${etiqueta}) en efectivo?`;
export const GASTO_SIN_DESCRIPCION = 'un gasto de';
export const AYUDA_POR_ASIGNAR = 'Si sí, lo paso a tu efectivo antes de contar.';
export const CHIP_EN_EFECTIVO = 'Sí, en efectivo';
export const preguntaSobrante = (extra: Centavos): string =>
  `Traes ${$(extra)} más de lo esperado. ¿De dónde salió?`;
export const OPCIONES_SOBRANTE = {
  me_dieron: 'Me dieron dinero',
  anote_de_mas: 'Anoté algo de más',
  no_se: 'No sé, solo corrígelo',
} as const;
export const opcionMePago = (nombre: string): string => `Me pagó ${nombre}`;
export const tituloFaltan = (traes: Centavos, hueco: Centavos): string =>
  `Traes ${$(traes)}: faltan ${$(hueco)}`;
export const tituloSobran = (traes: Centavos, extra: Centavos): string =>
  `Traes ${$(traes)}: sobran ${$(extra)}`;
export const tituloCuadra = (traes: Centavos): string => `Traes ${$(traes)}: tu efectivo cuadra`;
export const EFECTO_REPARTO = 'Lo repartí según tus gastos en efectivo. Toca una línea para moverle.';
export const pistaAproximado = (traes: Centavos): string =>
  `Dijiste «como ${$(traes)}»: si cuentas exacto, dímelo.`;
export const opcionPasarA = (nombre: string): string => `Pasar a ${nombre}`;
export const ETIQUETA_DE_DONDE = 'De dónde salió';
export const ETIQUETA_MARCADOS = 'Pasan a tu efectivo';
export const ETIQUETA_SIN_REVISAR = 'Sin revisar';
export const valorSinRevisar = (n: number): string =>
  n === 1 ? '1 gasto sin método; revísalo en Cambiar' : `${n} gastos sin método; revísalos en Cambiar`;
export const valorMarcados = (n: number, total: Centavos): string =>
  n === 1 ? `1 gasto de ${$(total)}` : `${n} gastos, ${$(total)}`;
export const CONFIRMAR = 'Confirmar';
export const CAMBIAR = 'Cambiar';
export const MENSAJE_CUADRA = 'Listo: tu efectivo cuadra.';
export const mensajeEfectivoQuedo = (monto: Centavos): string => `Listo: tu efectivo quedó en ${$(monto)}.`;

// ——— Pagar tarjeta ———

export const SIN_TARJETAS = 'Todavía no tienes tarjetas. Agrégalas en Cuentas.';
export const SIN_CUENTAS_PAGO =
  'Para pagar una tarjeta necesito saber de qué cuenta sale. Agrégala en Cuentas.';
export const PREGUNTA_CUAL_TARJETA = '¿Cuál tarjeta pagas?';
export const preguntaMontoPago = (nombre: string): string => `¿Cuánto pagas a tu ${nombre}?`;
export const ayudaPngi = (pngi: Centavos, vence: PlainDate): string =>
  `Para no generar intereses: ${$(pngi)}, vence el ${fechaCorta(vence)}.`;
export const ayudaDeuda = (deuda: Centavos): string => `Debes ${$(deuda)}.`;
export const chipPagar = (monto: Centavos): string => `Pagar ${$(monto)}`;
export const PREGUNTA_CUENTA_PAGO = '¿De qué cuenta sale?';
export const ETIQUETA_DESDE = 'Desde';
export const mensajePago = (nombre: string, monto: Centavos): string =>
  `Registré: pago a tu ${nombre} ${$(monto)}.`;
