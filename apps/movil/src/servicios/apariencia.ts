import { z } from 'zod';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste } from './preferencias';

/**
 * Ajustes › Apariencia (`02 §16`). Decisión de Adam (26-10-2026): la app se ve en claro aunque el teléfono esté en
 * oscuro; el oscuro solo si la persona lo elige, o si elige «Como el teléfono» (`sistema`).
 */
export const APARIENCIAS = ['claro', 'oscuro', 'sistema'] as const;
export type Apariencia = (typeof APARIENCIAS)[number];

export const APARIENCIA_POR_OMISION: Apariencia = 'claro';

const CLAVE = 'apariencia';
const AjusteApariencia = z.strictObject({ apariencia: z.enum(APARIENCIAS) });

/** La apariencia guardada. Sin nada guardado, o con un valor que esta versión no conoce, es claro. */
export function obtenerApariencia(ctx: Contexto): Apariencia {
  const r = AjusteApariencia.safeParse(leerAjuste(ctx, CLAVE, z.unknown()));
  return r.success ? r.data.apariencia : APARIENCIA_POR_OMISION;
}

/** Guarda la elección; como el resto de Ajustes, pide el aviso de privacidad aceptado (CA-M2-05). */
export function fijarApariencia(ctx: Contexto, apariencia: Apariencia): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, CLAVE, AjusteApariencia, { apariencia });
}
