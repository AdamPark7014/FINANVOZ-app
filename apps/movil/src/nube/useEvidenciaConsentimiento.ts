import { useEffect, useRef } from 'react';
import { evidenciaPendiente, sincronizarEvidencia, type PuertoEvidencia } from '../servicios';
import { useSesion } from '../sesion/ProveedorSesion';

/**
 * Manda al servidor la copia mínima de la evidencia del consentimiento (`08 §2`) en cuanto existe, al abrir la
 * app y al volver internet, hasta que el servidor la tenga. Sin Supabase configurado no hace nada.
 */
export function useEvidenciaConsentimiento(puerto: PuertoEvidencia | null): void {
  const { ctx, nube, version } = useSesion();
  const enCurso = useRef(false);
  useEffect(() => {
    if (!puerto) return;
    const correr = () => {
      try {
        if (enCurso.current || !evidenciaPendiente(ctx)) return;
      } catch {
        return;
      }
      enCurso.current = true;
      void sincronizarEvidencia(ctx, puerto).finally(() => {
        enCurso.current = false;
      });
    };
    correr();
    return nube?.conectividad.alReconectar(correr);
  }, [ctx, nube, puerto, version]);
}
