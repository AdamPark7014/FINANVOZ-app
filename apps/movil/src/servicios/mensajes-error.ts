import { ErrorDominio } from '@cartera/core';
import type { ErrorAccionCompartido } from './compartido';
import { MENSAJE_MOVIMIENTO_COMPARTIDO } from './formulario';

/**
 * Lo que ve la persona cuando algo falla (`02 §14`: qué pasó y qué puede hacer). Un solo lugar para el mapeo
 * código → mensaje, que usan la voz y las pantallas. Los mensajes nunca llevan montos, comercios ni nombres, y
 * nada de esto se registra (regla 9): el `mensaje` técnico del `ErrorDominio` no llega a la UI.
 */

/** `02 §5`, punto 9. */
export const MENSAJE_NO_ENTENDI = 'No te entendí. Prueba así: «tacos 80 en efectivo».';
export const MENSAJE_ERROR_GENERAL = 'No pude guardarlo. Intenta de nuevo.';
/** Sin internet en algo que no se reintenta solo. */
export const MENSAJE_SIN_RED = 'No tengo internet ahora. Inténtalo de nuevo cuando tengas conexión.';
/** Sin internet en algo que sí se reintenta al volver la conexión. */
export const MENSAJE_SIN_RED_REINTENTO =
  'No tengo internet ahora. Lo guardé y lo intento cuando vuelva la conexión.';
export const MENSAJE_LIMITE_NUBE =
  'Ya usaste las frases que interpreto en internet por ahora. La guardé y la interpreto después.';
export const MENSAJE_SERVIDOR = 'No pude hablar con el servidor. Intenta de nuevo en un rato.';
export const MENSAJE_SIN_VINCULO = 'Este teléfono ya no está vinculado al grupo. Toca "Volver a vincular".';
export const MENSAJE_GRUPO_CERRADO = 'El grupo ya está cerrado.';
export const MENSAJE_YA_ANULADO = 'Ese movimiento ya estaba borrado. No tienes que hacer nada más.';
export const MENSAJE_NO_EXISTE = 'Ya no encuentro ese movimiento. Revísalo en Movimientos.';
export const MENSAJE_MONTO_INVALIDO = 'Revisa el monto: tiene que ser mayor que cero.';
export const MENSAJE_CORRECCION_NO_SOPORTADA =
  'Ese movimiento no lo puedo corregir así. Ábrelo en Movimientos.';
export const MENSAJE_MESES_SIN_TARJETA = 'Solo una compra con tarjeta de crédito se puede pasar a meses.';

const POR_CODIGO: ReadonlyMap<string, string> = new Map([
  ['ya_anulada', MENSAJE_YA_ANULADO],
  ['transaccion_inexistente', MENSAJE_NO_EXISTE],
  ['evento_inexistente', MENSAJE_NO_EXISTE],
  ['monto_invalido', MENSAJE_MONTO_INVALIDO],
  ['correccion_no_soportada', MENSAJE_CORRECCION_NO_SOPORTADA],
  ['meses_sin_tarjeta', MENSAJE_MESES_SIN_TARJETA],
  ['movimiento_compartido', MENSAJE_MOVIMIENTO_COMPARTIDO],
  [
    'evento_ajeno',
    'Solo puedes anular lo que registraste tú. Pídele a tu pareja que lo anule desde su teléfono.',
  ],
  ['grupo_cerrado', MENSAJE_GRUPO_CERRADO],
  ['no_miembro', MENSAJE_SIN_VINCULO],
  ['sin_llave', MENSAJE_SIN_VINCULO],
  ['llaves_compartido_invalidas', MENSAJE_SIN_VINCULO],
  ['sin_red', MENSAJE_SIN_RED],
  ['respuesta_invalida', MENSAJE_NO_ENTENDI],
  ['limite_diario', MENSAJE_LIMITE_NUBE],
  ['limite_mensual', MENSAJE_LIMITE_NUBE],
  ['tope_global', MENSAJE_LIMITE_NUBE],
]);

/** Mensaje concreto para un código conocido; `null` si no hay uno. */
export function mensajePorCodigo(codigo: string): string | null {
  return POR_CODIGO.get(codigo) ?? null;
}

/** Mensaje para cualquier error atrapado: el de su código si se conoce; si no, `siNo`. */
export function mensajeError(error: unknown, siNo: string = MENSAJE_ERROR_GENERAL): string {
  return error instanceof ErrorDominio ? (mensajePorCodigo(error.codigo) ?? siNo) : siNo;
}

/**
 * Gastos compartidos (`02 §27`). `reintenta`: lo pendiente se vuelve a intentar solo al volver la red (agregar,
 * saldar, anular y sincronizar); crear, unirse, mostrar el código o salir no.
 */
export function mensajeErrorCompartido(
  error: ErrorAccionCompartido,
  opciones: { reintenta?: boolean } = {},
): string {
  switch (error) {
    case 'sin_red':
      return opciones.reintenta ? MENSAJE_SIN_RED_REINTENTO : MENSAJE_SIN_RED;
    case 'sin_servicio':
      return 'Esta versión de la app no tiene activado compartir gastos.';
    case 'no_miembro':
    case 'sin_llave':
      return MENSAJE_SIN_VINCULO;
    case 'grupo_cerrado':
      return MENSAJE_GRUPO_CERRADO;
    case 'codigo_invalido':
      return 'Ese código ya venció o ya se usó. Pídele a tu pareja que toque "Mostrar código" otra vez.';
    case 'ya_miembro':
      return 'Ese es tu propio código: tu pareja debe escanearlo desde su teléfono.';
    case 'otro_lugar':
      return 'Ese código es para otro teléfono. Pídele a tu pareja que toque "Mostrar código" otra vez.';
    case 'qr_invalido':
      return 'Ese código no es de Finanvoz. Escanea el que aparece en la app de tu pareja.';
    case 'evento_ilegible':
      return 'Llegó algo que no pude leer. Intenta de nuevo; si sigue, vuelve a vincular.';
    case 'sin_sesion':
    case 'conflicto':
    case 'servidor':
      return MENSAJE_SERVIDOR;
  }
}
