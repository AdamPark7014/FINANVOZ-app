import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Buzón de una sola confirmación entre pantallas: una edición que vive fuera de las pestañas (Ajustes › Ingreso)
 * deja "Listo: …" y la pantalla a la que se regresa (Hoy o Ajustes) la muestra al recuperar el foco. Solo guarda
 * el texto ya redactado para la UI; nunca se registra ni sale del teléfono.
 */
let pendiente: string | null = null;

export function dejarConfirmacion(mensaje: string): void {
  pendiente = mensaje;
}

/** Lee la confirmación pendiente y vacía el buzón. */
export function tomarConfirmacion(): string | null {
  const mensaje = pendiente;
  pendiente = null;
  return mensaje;
}

/** Al recuperar el foco, entrega la confirmación pendiente (si hay) a `alRecibir`. */
export function useConfirmacionAlVolver(alRecibir: (mensaje: string) => void): void {
  const ultimo = useRef(alRecibir);
  useEffect(() => {
    ultimo.current = alRecibir;
  }, [alRecibir]);
  useFocusEffect(
    useCallback(() => {
      const mensaje = tomarConfirmacion();
      if (mensaje) ultimo.current(mensaje);
    }, []),
  );
}
