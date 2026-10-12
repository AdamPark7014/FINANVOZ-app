import { z } from 'zod';
import { TIEMPO_MAXIMO_MS, type Transporte } from '@cartera/nlu';
import type { SesionNube } from '../nube/sesion';
import type { Contexto } from '../servicios/contexto';
import { escribirAjuste, leerAjuste } from '../servicios/preferencias';
import { obtenerConsentimiento } from './consentimiento';

/**
 * Copia mínima de la evidencia del consentimiento en Supabase (`08 §2`): `{usuario_anonimo, version_aviso,
 * aceptado_en}`. El usuario lo pone el servidor desde el JWT de la sesión anónima; nada más sale.
 */
export interface CuerpoEvidencia {
  readonly version_aviso: string;
  /** ISO 8601 UTC. */
  readonly aceptado_en: string;
}

export interface PuertoEvidencia {
  /** `true` si el servidor ya la tiene (recién guardada o repetida). */
  enviar(cuerpo: CuerpoEvidencia): Promise<boolean>;
}

const CLAVE = 'consentimiento_servidor';
const Enviada = z.strictObject({ version: z.string().min(1), enviado_en: z.int().min(0) });

/** ¿Hay una evidencia local que el servidor todavía no tiene? */
export function evidenciaPendiente(ctx: Contexto): boolean {
  const c = obtenerConsentimiento(ctx);
  if (!c) return false;
  return leerAjuste(ctx, CLAVE, Enviada)?.version !== c.version;
}

/** Envía la evidencia si falta; nunca lanza. Devuelve `true` si el servidor ya la tiene. */
export async function sincronizarEvidencia(ctx: Contexto, puerto: PuertoEvidencia): Promise<boolean> {
  try {
    const c = obtenerConsentimiento(ctx);
    if (!c) return false;
    if (!evidenciaPendiente(ctx)) return true;
    const ok = await puerto.enviar({
      version_aviso: c.version,
      aceptado_en: new Date(c.aceptado_en).toISOString(),
    });
    if (ok) escribirAjuste(ctx, CLAVE, Enviada, { version: c.version, enviado_en: ctx.reloj.ahora() });
    return ok;
  } catch {
    // Sin red o base cerrada: se intenta al volver a abrir o al reconectar.
    return false;
  }
}

/** `POST /rest/v1/consentimiento` (PostgREST) con la llave `anon` y el JWT de la sesión anónima. */
export function crearPuertoEvidencia(opciones: {
  url: string;
  llaveAnonima: string;
  sesion: Pick<SesionNube, 'obtenerToken'>;
  transporte?: Transporte;
}): PuertoEvidencia {
  const base = opciones.url.replace(/\/+$/, '');
  const transporte: Transporte = opciones.transporte ?? ((url, p) => globalThis.fetch(url, p));
  const intentar = async (renovar: boolean, cuerpo: CuerpoEvidencia): Promise<number | null> => {
    const token = await opciones.sesion.obtenerToken({ renovar });
    if (!token) return null;
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
    try {
      const r = await transporte(`${base}/rest/v1/consentimiento`, {
        method: 'POST',
        headers: {
          apikey: opciones.llaveAnonima,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      });
      return r.status;
    } finally {
      clearTimeout(temporizador);
    }
  };
  return {
    async enviar(cuerpo) {
      let estado = await intentar(false, cuerpo);
      if (estado === 401) estado = await intentar(true, cuerpo);
      // 409: ya existía esa versión para este usuario.
      return estado !== null && ((estado >= 200 && estado < 300) || estado === 409);
    },
  };
}
