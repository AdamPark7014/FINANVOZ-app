import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

/** Redacción de cuentas divididas, cobros y personas (`02 §17`, `02 §14`): solo presentación. */

export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Regresa a Cuentas';
export const ETIQUETA_COBRAR = 'Cobrar';
/** TalkBack en ficha cuando te deben (`02 §19`). */
export const PISTA_COBRAR = 'Arma el mensaje para pedirle que te pague';
export const ETIQUETA_YA_ME_PAGO = 'Ya me pagó';
/** TalkBack en ficha cuando te deben (`02 §19`). */
export const PISTA_YA_ME_PAGO = 'Registra cuánto te pagó';
export const ETIQUETA_GUARDAR = 'Guardar';
/** TalkBack al registrar un pago recibido (`02 §19`). */
export const PISTA_GUARDAR_PAGO = 'Guarda en el libro cuánto te pagó';
export const ETIQUETA_GUARDAR_Y_COBRAR = 'Guardar y cobrar';
export const ETIQUETA_MONTO = 'Monto';
export const ETIQUETA_A_DONDE_LLEGO = '¿A dónde te llegó?';
export const ETIQUETA_QUITAR_RECORDATORIO = 'Quitar recordatorio';

export const TITULO_MOVIMIENTOS = 'Movimientos';
export const TITULO_PEDIR_DATOS_COBRO = '¿A dónde te pagan?';
export const AYUDA_PEDIR_DATOS_COBRO =
  'Para cobrar, primero dime tus datos. Solo te los pido una vez.';
export const TITULO_YA_ME_PAGO = '¿Cuánto te pagó?';
export const TITULO_RECORDATORIO_COBRO = '¿Te recuerdo cobrar?';

/** Detalle cuando te deben: no infla E4 hasta el cobro (regla 12). */
export const TIP_SALDO_TE_DEBEN = 'No suma a tu dinero libre hasta que te paguen.';

export const ERROR_MONTO_MAYOR_CERO = 'Escribe un monto mayor a $0.';

export function mensajeRegistroCobro(monto: Centavos): string {
  return `Registré que te pagó ${formatearCentavos(monto)}`;
}

export function mensajeRecordatorioCobro(etiquetaFecha: string): string {
  return `Te recuerdo cobrar el ${etiquetaFecha}.`;
}

export const MENSAJE_SIN_AVISOS = 'No puedo programar avisos en este teléfono.';
export const MENSAJE_PERMISO_AVISOS =
  'Activa los avisos en los ajustes de tu teléfono para que te lo recuerde.';
export const MENSAJE_ERROR_RECORDATORIO = 'No pude programar el aviso. Intenta de nuevo.';

/** "Registré: la cena $1,200 · te deben $900". */
export function mensajeCuentaDividida(
  descripcion: string | null,
  total: number,
  porCobrarTotal: number,
): string {
  const que = descripcion ?? 'Cuenta dividida';
  return `Registré: ${que} ${formatearCentavos(total)} · te deben ${formatearCentavos(porCobrarTotal)}`;
}

/** "Elige 3 personas (llevas 1)." */
export function textoFaltanPersonas(faltan: number, llevas: number): string {
  const personas = faltan === 1 ? '1 persona' : `${faltan} personas`;
  return `Elige ${personas} (llevas ${llevas}).`;
}

export const TITULO_CONFIRMAR_DIVISION = '¿Con quién dividiste la cuenta?';

export const MENSAJES_DATOS_COBRO: Record<string, string> = {
  datos_cobro_vacios: 'Escribe tu celular o tu CLABE.',
  celular_invalido: 'El celular debe tener 10 dígitos.',
  clabe_invalida: 'Esa CLABE no es válida. Revisa los 18 dígitos.',
};

export const AYUDA_DATOS_COBRO =
  'Se guardan solo en este teléfono y van en el mensaje cuando cobras. No los mandamos a ningún lado.';

/** Saldo de la persona en palabras: "Te debe" / "Le debes" / "Están a mano". */
export function etiquetaSaldoPersona(saldo: number): string {
  if (saldo > 0) return 'Te debe';
  if (saldo < 0) return 'Le debes';
  return 'Están a mano';
}

export const MENSAJE_COMPARTIR_NO_DISPONIBLE = 'No pude abrir la hoja de compartir. Intenta de nuevo.';

/** Detalle: id que ya no existe en el libro (`02 §17`). */
export const TEXTO_PERSONA_NO_ENCONTRADA = 'No encontré a esa persona.';

/** Detalle: aún no hay préstamos ni cuentas divididas con ella. */
export const TEXTO_MOVIMIENTOS_PERSONA_VACIO = 'Todavía no hay movimientos con esta persona.';

/** Cuenta dividida: aún no hay contactos guardados. */
export const TEXTO_CONTACTOS_VACIO =
  'Todavía no tienes contactos. Escribe abajo a quien te debe y elige a cada uno.';

export const ERROR_DIVISION_TOTAL = 'Escribe cuánto fue en total.';
export const ERROR_DIVISION_REPARTO = 'El total no alcanza para repartirlo entre todos.';
export const ERROR_DIVISION_CATEGORIA = 'Elige una categoría.';
export const ETIQUETA_CATEGORIA_PARTE = 'Categoría de tu parte';
export const ETIQUETA_ORIGEN_DIVISION = '¿Con qué pagaste?';
export const ERROR_DIVISION_ORIGEN = ETIQUETA_ORIGEN_DIVISION;
