import { useCallback, useEffect } from 'react';
import { deshacer, mensajeError, obtenerHoy, type Contexto, type VistaHoy } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { formatearCentavos } from '../../ui';
import { useMostrarAviso } from './ProveedorAvisos';
import { lineaCambioDia } from './textos';

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
 * La cifra de "Hoy puedes" tal como la muestra Hoy (`02 §4.2`): pesos enteros hacia abajo, "$0" en libre negativo
 * y nada sin ingreso configurado.
 */
export function cifraHoyMostrada(v: VistaHoy): string | null {
  if (v.estado === 'sin_ingreso') return null;
  return formatearCentavos(v.estado === 'libre_negativo' ? 0 : v.hoyPuedesCentavos, 'pesos');
}

// La última cifra que Hoy pintó para cada libro: es el "antes" que vio la persona. Sin Hoy montado no hay "antes".
const hoyVisto = new WeakMap<Contexto, string>();

/** Hoy recuerda la cifra que mostró para que el aviso de registro diga cómo cambió. */
export function useRecordarHoyVisto(cifra: string | null): void {
  const { ctx } = useSesion();
  useEffect(() => {
    if (cifra === null) return;
    hoyVisto.set(ctx, cifra);
    return () => {
      hoyVisto.delete(ctx);
    };
  }, [ctx, cifra]);
}

/**
 * El aviso se cierra justo después de su acción ("Deshacer"): un mensaje de error mostrado dentro de la acción se
 * cerraría con él, así que sale en el siguiente ciclo.
 */
export function mostrarDespuesDeCerrar(mostrar: (datos: { mensaje: string }) => void, mensaje: string): void {
  setTimeout(() => mostrar({ mensaje }), 0);
}

/** "Tu día pasa de $214 a $194." si la cifra de Hoy cambió con lo que se acaba de escribir; si no, `null`. */
function cambioDelDia(ctx: Contexto): string | null {
  const antes = hoyVisto.get(ctx);
  if (antes === undefined) return null;
  let despues: string | null;
  try {
    despues = cifraHoyMostrada(obtenerHoy(ctx));
  } catch {
    // Sin la cifra nueva no se dice nada (sin detalle en logs, regla 9).
    return null;
  }
  return despues === null || despues === antes ? null : lineaCambioDia(antes, despues);
}

/**
 * Registro optimista con Deshacer (02-UX §1.3, RF-REG-04): refresca las vistas y muestra el aviso
 * 10 s (mínimo). Si Hoy está montado y su cifra cambió, una segunda línea lo dice ("Tu día pasa de $214 a $194.").
 * "Deshacer" anula lo registrado con el token del servicio; si falla, lo dice en el aviso. Si hay `transaccionId`
 * y `alVerDetalle`, tocar el mensaje abre ese movimiento.
 */
export function useAvisoRegistro(alVerDetalle?: (transaccionId: string) => void) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  return useCallback(
    (mensaje: string, deshacerOExtra?: string | ExtraAvisoRegistro) => {
      const { deshacer: token, transaccionId } = extraDe(deshacerOExtra);
      const cambio = cambioDelDia(ctx);
      refrescar();
      mostrar({
        mensaje: cambio ? `${mensaje}\n${cambio}` : mensaje,
        ...(token
          ? {
              accion: {
                etiqueta: 'Deshacer',
                alPresionar: () => {
                  try {
                    deshacer(ctx, token);
                    refrescar();
                  } catch (e) {
                    mostrarDespuesDeCerrar(mostrar, mensajeError(e));
                  }
                },
              },
            }
          : {}),
        ...(transaccionId && alVerDetalle ? { alPresionarMensaje: () => alVerDetalle(transaccionId) } : {}),
      });
    },
    [alVerDetalle, ctx, refrescar, mostrar],
  );
}
