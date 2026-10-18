import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import type { Contexto } from '../servicios/contexto';
import { borrarAjuste, escribirAjuste, leerAjuste } from '../servicios/preferencias';

/**
 * Versión del aviso de privacidad simplificado y del texto de consentimiento de O2 (`02 §3`, `08`). Cambia
 * cuando cambia el texto: la evidencia guarda la versión que la persona aceptó.
 */
export const VERSION_CONSENTIMIENTO = '2026-10-m8';

const CLAVE = 'consentimiento';
const CLAVE_HISTORIAL = 'consentimiento_historial';
const CLAVE_SOLO_LECTURA = 'consentimiento_solo_lectura';

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
  medio: z.enum(['onboarding', 'semilla', 'reconsentimiento']),
});
export type EvidenciaConsentimiento = z.infer<typeof EvidenciaConsentimiento>;

const HistorialConsentimiento = z.array(EvidenciaConsentimiento);

/** Rechazo del aviso nuevo (pendiente 31): ver y exportar sí; registrar no. */
const SoloLecturaConsentimiento = z.strictObject({
  activo: z.literal(true),
  /** Versión del aviso que la persona no aceptó. */
  version_objetivo: z.string().min(1),
  rechazado_en: z.int().min(0),
});
export type SoloLecturaConsentimiento = z.infer<typeof SoloLecturaConsentimiento>;

/** Orden de versiones `YYYY-MM-mN` (p. ej. `2026-10-m8`). */
export function compararVersionAviso(a: string, b: string): number {
  const partes = (v: string) => {
    const m = /^(\d{4})-(\d{2})-m(\d+)$/.exec(v);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  };
  const pa = partes(a);
  const pb = partes(b);
  if (!pa || !pb) return a.localeCompare(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i]! < pb[i]!) return -1;
    if (pa[i]! > pb[i]!) return 1;
  }
  return 0;
}

export function versionAvisoDesactualizada(version: string): boolean {
  return compararVersionAviso(version, VERSION_CONSENTIMIENTO) < 0;
}

export function obtenerHistorialConsentimiento(ctx: Contexto): readonly EvidenciaConsentimiento[] {
  return leerAjuste(ctx, CLAVE_HISTORIAL, HistorialConsentimiento) ?? [];
}

function agregarAlHistorial(ctx: Contexto, evidencia: EvidenciaConsentimiento): void {
  const previo = obtenerHistorialConsentimiento(ctx);
  escribirAjuste(ctx, CLAVE_HISTORIAL, HistorialConsentimiento, [...previo, evidencia]);
}

export function enSoloLectura(ctx: Contexto): boolean {
  const sl = leerAjuste(ctx, CLAVE_SOLO_LECTURA, SoloLecturaConsentimiento);
  return sl?.activo === true && sl.version_objetivo === VERSION_CONSENTIMIENTO;
}

/**
 * Hay un aviso más reciente que el aceptado y la persona aún no aceptó ni eligió solo lectura para esta versión.
 */
export function requiereReconsentimiento(ctx: Contexto): boolean {
  const c = obtenerConsentimiento(ctx);
  if (!c || !versionAvisoDesactualizada(c.version)) return false;
  return !enSoloLectura(ctx);
}

/**
 * O2 / reconsentimiento: guarda la evidencia del consentimiento. Sin `datosFinancieros = true` no se acepta nada.
 * La evidencia de la misma versión no se reescribe; una versión nueva archiva la anterior en el historial.
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
  const versionNueva = opciones.version ?? VERSION_CONSENTIMIENTO;
  const previa = obtenerConsentimiento(ctx);
  if (previa?.version === versionNueva) return previa;
  if (previa && compararVersionAviso(previa.version, versionNueva) > 0) return previa;

  if (previa) {
    agregarAlHistorial(ctx, previa);
    borrarAjuste(ctx, CLAVE_SOLO_LECTURA);
  }

  const evidencia: EvidenciaConsentimiento = {
    version: versionNueva,
    aceptado_en: ctx.reloj.ahora(),
    fecha: ctx.reloj.hoy(),
    datos_financieros: true,
    estadisticas: opciones.estadisticas ?? previa?.estadisticas ?? false,
    medio: opciones.medio ?? (previa ? 'reconsentimiento' : 'onboarding'),
  };
  escribirAjuste(ctx, CLAVE, EvidenciaConsentimiento, evidencia);
  return evidencia;
}

/** Pendiente 31: sigue viendo sus datos pero no registra hasta aceptar el aviso nuevo o borrar todo. */
export function rechazarReconsentimiento(ctx: Contexto): void {
  const c = obtenerConsentimiento(ctx);
  if (!c || !versionAvisoDesactualizada(c.version)) return;
  escribirAjuste(ctx, CLAVE_SOLO_LECTURA, SoloLecturaConsentimiento, {
    activo: true,
    version_objetivo: VERSION_CONSENTIMIENTO,
    rechazado_en: ctx.reloj.ahora(),
  });
}

export function obtenerConsentimiento(ctx: Contexto): EvidenciaConsentimiento | null {
  return leerAjuste(ctx, CLAVE, EvidenciaConsentimiento);
}

/**
 * Todo caso de uso que escribe datos del usuario lo llama primero (CA-M2-05).
 * En solo lectura (aviso nuevo rechazado) también falla con `solo_lectura`; lo usan registrar, captura, arqueo
 * y el resto de servicios de escritura vía esta misma función.
 */
export function exigirConsentimiento(ctx: Contexto): void {
  if (!obtenerConsentimiento(ctx)) {
    throw new ErrorDominio('sin_consentimiento', 'acepta el aviso de privacidad antes de guardar datos');
  }
  if (enSoloLectura(ctx)) {
    throw new ErrorDominio(
      'solo_lectura',
      'acepta la nueva versión del aviso de privacidad para seguir registrando datos',
    );
  }
}
