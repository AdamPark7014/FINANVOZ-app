/** Copy de la invitación a avisos de tarjetas en Hoy (`02 §1`, `02 §14`, tuteo). */

import { etiquetaHablada } from '../../ui/formato';

export const TITULO_INVITACION_AVISOS = '¿Te aviso antes de que venzan tus tarjetas?';
export const CUERPO_INVITACION_AVISOS =
  'Te aviso el día de corte y 3 días antes del límite de pago, con lo que tienes que pagar para no generar intereses. Los avisos se quedan en tu teléfono.';
export const BTN_INVITACION_AVISOS_SI = 'Sí, avísame';
export const BTN_INVITACION_AVISOS_NO = 'Ahora no';

/** TalkBack: invitación en Hoy antes del diálogo del sistema (`02 §1`, `02 §15`). */
export const PISTA_INVITACION_AVISOS_SI = 'Pide permiso para mandarte avisos en este teléfono';
export const PISTA_INVITACION_AVISOS_NO =
  'Cierra la invitación; puedes activar avisos después en Ajustes › Avisos';

export function etiquetaAccesibleInvitacionAvisos(): string {
  const texto = `${TITULO_INVITACION_AVISOS} ${CUERPO_INVITACION_AVISOS}`.replace('3 días', 'tres días');
  return etiquetaHablada(texto);
}
