import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import type { Contexto } from '../servicios/contexto';
import { escribirAjuste, leerAjuste } from '../servicios/preferencias';

/**
 * Versión del aviso de privacidad simplificado y del texto de consentimiento de O2 (`02 §3`, `08`). Cambia
 * cuando cambia el texto: la evidencia guarda la versión que la persona aceptó.
 */
export const VERSION_CONSENTIMIENTO = '2026-10-m7';

const CLAVE = 'consentimiento';

/** Evidencia local del consentimiento expreso para datos financieros (RF-PRI-01). */
export const EvidenciaConsentimiento = z.strictObject({
  version: z.string().min(1),
  /** Instante de aceptación en ms UTC. */
  aceptado_en: z.int().min(0),
  /** Fecha civil del usuario al aceptar. */
  fecha: z.string(),
  /** Casilla obligatoria: datos financieros. Siempre `true` en una evidencia. */
  datos_financieros: z.literal(true),
  /** Casilla opcional de estadísticas anónimas (apagada por defecto). */
  estadisticas: z.boolean(),
  /** `semilla` solo en builds de desarrollo (cargador de escenarios). */
  medio: z.enum(['onboarding', 'semilla']),
});
export type EvidenciaConsentimiento = z.infer<typeof EvidenciaConsentimiento>;

/**
 * O2: guarda la evidencia del consentimiento (es lo primero que se escribe). Sin `datosFinancieros = true` no se
 * acepta nada. Si ya existe, la conserva (la evidencia original no se reescribe).
 */
export function aceptarConsentimiento(
  ctx: Contexto,
  opciones: {
    datosFinancieros: boolean;
    estadisticas?: boolean;
    version?: string;
    medio?: EvidenciaConsentimiento['medio'];
  },
): EvidenciaConsentimiento {
  if (opciones.datosFinancieros !== true) {
    throw new ErrorDominio('consentimiento_requerido', 'falta aceptar el uso de datos financieros');
  }
  const previa = obtenerConsentimiento(ctx);
  if (previa) return previa;
  const evidencia: EvidenciaConsentimiento = {
    version: opciones.version ?? VERSION_CONSENTIMIENTO,
    aceptado_en: ctx.reloj.ahora(),
    fecha: ctx.reloj.hoy(),
    datos_financieros: true,
    estadisticas: opciones.estadisticas ?? false,
    medio: opciones.medio ?? 'onboarding',
  };
  escribirAjuste(ctx, CLAVE, EvidenciaConsentimiento, evidencia);
  return evidencia;
}

export function obtenerConsentimiento(ctx: Contexto): EvidenciaConsentimiento | null {
  return leerAjuste(ctx, CLAVE, EvidenciaConsentimiento);
}

/** Todo caso de uso que escribe datos del usuario lo llama primero (CA-M2-05). */
export function exigirConsentimiento(ctx: Contexto): void {
  if (!obtenerConsentimiento(ctx)) {
    throw new ErrorDominio('sin_consentimiento', 'acepta el aviso de privacidad antes de guardar datos');
  }
}
