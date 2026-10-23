import { useState } from 'react';
import { View } from 'react-native';
import type { PrellenadoR2 } from '../../asistente/registro';
import { descartarPorInterpretar } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Pantalla, Texto } from '../../ui';
import { FormularioMovimiento, type MovimientoGuardado } from '../principal/FormularioMovimiento';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { ACCESIBILIDAD_CERRAR_R2, BTN_CERRAR_R2, PISTA_CERRAR_R2, textoEstoOiR2, TITULO_R2 } from './textos';

/**
 * R2 «formulario corto» (maqueta Registrar R2): lo que abre «Cambiar» en la tarjeta «Entendí» o la reparación de
 * «No entendí», con lo dicho ya puesto. Es una hoja modal (`/registrar`); al guardar vuelve al asistente, que
 * muestra «Registré…» con Deshacer. Lo dicho llega en memoria, nunca en la ruta (regla 9).
 */
export function PantallaR2({
  prellenado,
  alCerrar,
  alGuardado,
}: {
  prellenado: PrellenadoR2 | null;
  alCerrar: () => void;
  /** Lo guardado, para el asistente (`avisarGuardadoR2`). */
  alGuardado: (g: MovimientoGuardado) => void;
}) {
  const { ctx } = useSesion();
  const [inicial] = useState(prellenado);
  const { oido, porInterpretarId, ...datos } = inicial ?? {};
  return (
    // Fuera de las pestañas: el aviso de errores del formulario vive aquí mismo.
    <ProveedorAvisos>
      <Pantalla testID="pantalla-registrar" bordes={['top', 'left', 'right', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: espacio.s,
          }}
        >
          <Boton
            etiqueta={BTN_CERRAR_R2}
            variante="texto"
            ancho="contenido"
            alPresionar={alCerrar}
            etiquetaAccesible={ACCESIBILIDAD_CERRAR_R2}
            pista={PISTA_CERRAR_R2}
            testID="boton-cerrar-registrar"
          />
          <Texto variante="subtitulo" testID="registrar-titulo" accessibilityRole="header">
            {TITULO_R2}
          </Texto>
          <View style={{ width: 64 }} />
        </View>
        {oido ? (
          <Texto variante="secundario" tono="secundario" testID="r2-esto-oi">
            {textoEstoOiR2(oido)}
          </Texto>
        ) : null}
        <FormularioMovimiento
          prellenado={datos}
          alRegistrado={(g) => {
            if (porInterpretarId) {
              try {
                descartarPorInterpretar(ctx, porInterpretarId);
              } catch {
                // Ya no estaba en «Por revisar».
              }
            }
            alGuardado(g);
          }}
          // Después de guardar (también la cuenta dividida) se vuelve al asistente.
          alGuardar={alCerrar}
        />
        <View style={{ height: espacio.xxxl }} />
      </Pantalla>
    </ProveedorAvisos>
  );
}
