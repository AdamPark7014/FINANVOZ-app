import { useState } from 'react';
import { obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Tarjeta, Texto } from '../../ui';
import { useConfirmacionAlVolver } from './confirmacion';
import {
  ETIQUETA_CAMBIAR_INGRESO,
  ETIQUETA_CONFIGURAR_INGRESO,
  SECCION_INGRESO,
} from './ingreso-textos';
import { resumenIngreso } from './ingreso';

/** Ajustes ? Ingreso (`02 ?12`): cu?nto y cada cu?ndo te pagan, en palabras; "Cambiar" abre la edici?n. */
export function SeccionIngreso({ alCambiar }: { alCambiar: () => void }) {
  const { ctx } = useSesion();
  const vista = useVista(obtenerAjustes);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  useConfirmacionAlVolver(setConfirmacion);
  const configurado = vista.ingresoVariable || vista.ingreso !== null;
  return (
    <Tarjeta testID="ajustes-ingreso">
      <Texto variante="subtitulo">{SECCION_INGRESO}</Texto>
      <Texto variante="secundario" tono="secundario" testID="ajustes-ingreso-resumen">
        {resumenIngreso(vista, ctx.reloj.hoy())}
      </Texto>
      {confirmacion ? (
        <Texto
          variante="secundario"
          tono="acento"
          accessibilityLiveRegion="polite"
          testID="ajustes-ingreso-confirmacion"
        >
          {confirmacion}
        </Texto>
      ) : null}
      <Boton
        testID="ajustes-cambiar-ingreso"
        variante="secundario"
        etiqueta={configurado ? 'Cambiar mi ingreso' : 'Decir cada cu?ndo me pagan'}
        alPresionar={alCambiar}
      />
    </Tarjeta>
  );
}
