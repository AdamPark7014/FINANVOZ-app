import { useCallback } from 'react';
import { deshacer } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { useMostrarAviso } from './ProveedorAvisos';

/** Opciones del aviso inferior tras registrar (además del token de Deshacer). */
export type ExtraAvisoRegistro = {
  readonly deshacer?: string;
  /** Abre el detalle en Movimientos al tocar el mensaje (`02 §5`). */
  readonly transaccionId?: string;
};

function extraDe(deshacerOExtra?: string | ExtraAvisoRegistro): ExtraAvisoRegistro {
  if (deshacerOExtra === undefined) return {};
  return typeof deshacerOExtra === 'string' ? { deshacer: deshacerOExtra } : deshacerOExtra;
}

/**
 * Registro optimista con Deshacer (02-UX §1.3, RF-REG-04): refresca las vistas y muestra el aviso
 * 10 s (mínimo). "Deshacer" anula lo registrado con el token del servicio. Si hay
 * `transaccionId` y `alVerDetalle`, tocar el mensaje abre ese movimiento.
 */
export function useAvisoRegistro(alVerDetalle?: (transaccionId: string) => void) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  return useCallback(
    (mensaje: string, deshacerOExtra?: string | ExtraAvisoRegistro) => {
      const { deshacer: token, transaccionId } = extraDe(deshacerOExtra);
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
        ...(transaccionId && alVerDetalle
          ? { alPresionarMensaje: () => alVerDetalle(transaccionId) }
          : {}),
      });
    },
    [alVerDetalle, ctx, refrescar, mostrar],
  );
}
