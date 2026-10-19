import { z } from 'zod';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { obtenerBloqueo } from './ajustes';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste } from './preferencias';

const AjustesVozRespuesta = z.strictObject({ activa: z.boolean() });
export type AjustesVozRespuesta = z.infer<typeof AjustesVozRespuesta>;

/**
 * "Contestarte en voz": tras dictar, Finanvoz dice lo que registró y cuánto puedes gastar hoy. Encendido por
 * omisión, salvo con el bloqueo biométrico activo (quien protege la app tampoco quiere cifras en voz alta).
 */
export function obtenerVozRespuesta(ctx: Contexto): AjustesVozRespuesta {
  return leerAjuste(ctx, 'voz_respuesta', AjustesVozRespuesta) ?? { activa: !obtenerBloqueo(ctx).activo };
}

export function fijarVozRespuesta(ctx: Contexto, activa: boolean): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, 'voz_respuesta', AjustesVozRespuesta, { activa });
}
