import { z } from 'zod';
import type { Contexto } from '../servicios/contexto';
import { borrarAjuste, escribirAjuste, leerAjuste } from '../servicios/preferencias';
import { exigirConsentimiento, obtenerConsentimiento } from './consentimiento';

/**
 * Finalidad secundaria "estadísticas de uso" (`08 §2`): apagada por omisión. El valor inicial es la casilla
 * opcional de O2 (guardada en la evidencia, que no se reescribe); los cambios posteriores desde el centro de
 * privacidad se guardan aparte con su fecha (derecho de oposición).
 */
const CLAVE = 'estadisticas';
const Estadisticas = z.strictObject({ activo: z.boolean(), cambiado_en: z.int().min(0) });

/** Identificador aleatorio de la instalación para la analítica; se borra al apagarla y con "Borrar todo". */
const CLAVE_ID = 'analitica_id';
const IdAnalitica = z.strictObject({ id: z.string().regex(/^[0-9a-f-]{36}$/) });

export function estadisticasActivas(ctx: Contexto): boolean {
  const consentimiento = obtenerConsentimiento(ctx);
  if (!consentimiento) return false;
  return leerAjuste(ctx, CLAVE, Estadisticas)?.activo ?? consentimiento.estadisticas;
}

/** Encender o apagar las estadísticas. Al apagarlas se olvida el identificador anónimo. */
export function fijarEstadisticas(ctx: Contexto, activo: boolean): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, CLAVE, Estadisticas, { activo, cambiado_en: ctx.reloj.ahora() });
  if (!activo) borrarAjuste(ctx, CLAVE_ID);
}

function uuidV4(bytes: Uint8Array): string {
  const b = Array.from(bytes.slice(0, 16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Identificador anónimo (UUID v4 aleatorio, sin relación con la base ni con el dispositivo). Se crea la primera
 * vez que hace falta.
 */
export function idAnonimoAnalitica(ctx: Contexto, aleatorio: (n: number) => Uint8Array): string {
  const actual = leerAjuste(ctx, CLAVE_ID, IdAnalitica);
  if (actual) return actual.id;
  const id = uuidV4(aleatorio(16));
  escribirAjuste(ctx, CLAVE_ID, IdAnalitica, { id });
  return id;
}
