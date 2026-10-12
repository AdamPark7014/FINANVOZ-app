import { useEffect } from 'react';
import { contarEsperandoConexion, procesarPorInterpretar } from '../servicios';
import { useSesion } from '../sesion/ProveedorSesion';

/**
 * CA-M3-05: al abrir la app y cada vez que vuelve internet, interpreta las frases guardadas en orden y refresca
 * las vistas si algo cambió. Sin nube no hace nada. Los errores se callan: la frase sigue en la cola (regla 9:
 * nada del texto llega a logs).
 */
export function useProcesarCola(): void {
  const { ctx, nube, refrescar } = useSesion();
  useEffect(() => {
    if (!nube) return;
    let vigente = true;
    const correr = () => {
      if (contarEsperandoConexion(ctx) === 0) return;
      procesarPorInterpretar(ctx, nube)
        .then((r) => {
          if (vigente && r.aplicadas + r.porRevisar > 0) refrescar();
        })
        .catch(() => {
          // Sin consentimiento o base cerrada: se intenta otra vez al reconectar.
        });
    };
    correr();
    const dejar = nube.conectividad.alReconectar(correr);
    return () => {
      vigente = false;
      dejar();
    };
  }, [ctx, nube, refrescar]);
}
