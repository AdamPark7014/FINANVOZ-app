import { useState } from 'react';
import { View } from 'react-native';
import { obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { FilaAjuste, Texto } from '../../ui';
import { espacio } from '../../ui/tokens';
import { useConfirmacionAlVolver } from './confirmacion';
import {
  etiquetaFilaIngreso,
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
    <View>
      <FilaAjuste
        icono="moneda"
        familia="super"
        testID="ajustes-cambiar-ingreso"
        testIDTitulo="ajustes-ingreso-titulo"
        testIDValor="ajustes-ingreso-resumen"
        tituloEsEncabezado
        titulo={SECCION_INGRESO}
        valor={resumen}
        pista={configurado ? PISTA_CAMBIAR_INGRESO : PISTA_CONFIGURAR_INGRESO}
        etiquetaAccesible={etiquetaFilaIngreso(resumen, configurado)}
        alPresionar={alCambiar}
      />
      {confirmacion ? (
        <Texto
          variante="secundario"
          tono="acento"
          accessibilityLiveRegion="polite"
          testID="ajustes-ingreso-confirmacion"
          style={{ paddingHorizontal: espacio.l, paddingBottom: espacio.m }}
        >
          {confirmacion}
        </Texto>
      ) : null}
    </View>
  );
}
