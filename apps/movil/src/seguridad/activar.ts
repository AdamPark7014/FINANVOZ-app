import type { Autenticador, ErrorAutenticacion } from './autenticador';

export type ResultadoActivacion = { activado: true } | { activado: false; motivo: ErrorAutenticacion };

/**
 * Antes de encender el bloqueo (RF-CFG-03): el teléfono debe tener cómo desbloquearse (biometría o código) y la
 * persona debe desbloquear una vez con éxito. Si se encendiera sin eso, la cortina nunca se podría quitar (un iPhone
 * sin código no autentica nunca). `sin_seguridad` dice que hay que poner un código en el teléfono; `cancelado` o
 * `fallo`, que no se pudo comprobar y el bloqueo sigue apagado.
 */
export async function comprobarParaActivar(autenticador: Autenticador): Promise<ResultadoActivacion> {
  let disponible: boolean;
  try {
    disponible = await autenticador.disponible();
  } catch {
    disponible = false;
  }
  if (!disponible) return { activado: false, motivo: 'sin_seguridad' };
  try {
    const r = await autenticador.autenticar();
    return r.exito ? { activado: true } : { activado: false, motivo: r.error };
  } catch {
    return { activado: false, motivo: 'fallo' };
  }
}
