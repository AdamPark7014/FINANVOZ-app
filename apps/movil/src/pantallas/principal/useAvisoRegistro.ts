import { useCallback } from 'react';
import { deshacer } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { useMostrarAviso } from './ProveedorAvisos';

/**
 * Registro optimista con Deshacer (02-UX §1.3, RF-REG-04): refresca las vistas y muestra el aviso 5 s. "Deshacer"
 * anula lo registrado con el token del servicio y vuelve a refrescar.
 */
export function useAvisoRegistro() {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  return useCallback(
    (mensaje: string, token?: string) => {
      refrescar();
      mostrar({
        mensaje,
        ...(token
          ? {
              accion: {
                etiqueta: 'Deshacer',
                alPresionar: () => {
                  deshacer(ctx, token);
                  refrescar();
                },
              },
            }
          : {}),
      });
    },
    [ctx, refrescar, mostrar],
  );
}
