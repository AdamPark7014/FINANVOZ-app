import { ErrorDominio } from '@cartera/core';

/**
 * Mensajes técnicos de analítica (`ErrorDominio`): solo para desarrollo; la UI y Sentry usan el `codigo`
 * (regla 9). Nunca incluyen montos, comercios, alias, nombres, RFC ni texto de notificaciones.
 */

/** Respuesta HTTP distinta de 2xx al enviar un evento ya validado. */
export const MENSAJE_TECNICO_ENVIO_HTTP = 'envio de analitica rechazado por el servidor';

/** Código estable para depuración (`analitica_http_404`, etc.); el cuerpo de la respuesta no entra aquí. */
export function codigoEnvioHttpAnalitica(status: number): string {
  return `analitica_http_${status}`;
}

export function errorEnvioHttpAnalitica(status: number): ErrorDominio {
  return new ErrorDominio(codigoEnvioHttpAnalitica(status), MENSAJE_TECNICO_ENVIO_HTTP);
}
