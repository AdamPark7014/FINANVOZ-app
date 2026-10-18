import { useState } from 'react';
import { obtenerAjustes } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Pantalla, Texto } from '../../ui';
import { ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { CamposIngreso, useFormularioIngreso } from './FormularioIngreso';
import {
  ETIQUETA_GUARDAR,
  ETIQUETA_VOLVER,
  INTRO_EDITAR,
  mensajeIngresoGuardado,
  PISTA_GUARDAR,
  PISTA_VOLVER,
  TITULO_EDITAR,
} from './ingreso-textos';
import { valoresDeIngreso } from './ingreso';

/**
 * Ajustes › Ingreso (`02 §12`, incluye el modo ingreso variable): las preguntas de O3 con lo que ya está guardado.
 * Al guardar entrega la confirmación ya redactada a quien la abrió.
 */
export function EditarIngreso({
  alVolver,
  alGuardar,
}: {
  alVolver: () => void;
  alGuardar: (confirmacion: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const hoy = ctx.reloj.hoy();
  const formulario = useFormularioIngreso(hoy, () => valoresDeIngreso(obtenerAjustes(ctx), hoy));
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    try {
      formulario.guardar(ctx);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    alGuardar(mensajeIngresoGuardado(formulario.variable, formulario.proximo));
  };

  return (
    <Pantalla
      testID="editar-ingreso"
      bordes={['top', 'left', 'right', 'bottom']}
      pie={
        <Boton
          testID="editar-ingreso-guardar"
          etiqueta={ETIQUETA_GUARDAR}
          pista={PISTA_GUARDAR}
          deshabilitado={!formulario.completo}
          alPresionar={guardar}
        />
      }
    >
      <Boton
        testID="editar-ingreso-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={alVolver}
      />
      <Texto variante="titulo" testID="editar-ingreso-titulo" accessibilityRole="header">
        {TITULO_EDITAR}
      </Texto>
      <Texto variante="cuerpo" tono="secundario" testID="editar-ingreso-intro">
        {INTRO_EDITAR}
      </Texto>
      <CamposIngreso formulario={formulario} prefijo="editar-ingreso" />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
