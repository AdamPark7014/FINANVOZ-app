import { useState } from 'react';
import { obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { FilaAjuste, Texto } from '../../ui';
import { useConfirmacionAlVolver } from './confirmacion';
import {
  PISTA_CAMBIAR_INGRESO,
  PISTA_CONFIGURAR_INGRESO,
  SECCION_INGRESO,
} from './ingreso-textos';
import { resumenIngreso } from './ingreso';

/** Ajustes › Ingreso (`02 §12`): cuánto y cada cuándo te pagan; tocas la fila para editar. */
export function SeccionIngreso({ alCambiar }: { alCambiar: () => void }) {
  const { ctx } = useSesion();
  const vista = useVista(obtenerAjustes);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  useConfirmacionAlVolver(setConfirmacion);
  const configurado = vista.ingresoVariable || vista.ingreso !== null;
  const resumen = resumenIngreso(vista, ctx.reloj.hoy());
  return (
    <>
      <FilaAjuste
        testID="ajustes-cambiar-ingreso"
        testIDTitulo="ajustes-ingreso-titulo"
        testIDValor="ajustes-ingreso-resumen"
        tituloEsEncabezado
        titulo={SECCION_INGRESO}
        valor={resumen}
        pista={configurado ? PISTA_CAMBIAR_INGRESO : PISTA_CONFIGURAR_INGRESO}
        etiquetaAccesible={`${SECCION_INGRESO}. ${resumen}`}
        alPresionar={alCambiar}
      />
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
    </>
  );
}
