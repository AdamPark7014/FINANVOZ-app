import { useState } from 'react';
import type { PropuestaGastoCompartido } from '../../servicios';
import { Boton, Tarjeta, Texto } from '../../ui';
import { Chips } from '../onboarding/componentes';
import { FormularioGastoCompartido } from './FormularioGastoCompartido';
import { BTN_CANCELAR, ETIQUETA_CON_QUIEN_COMPARTES, PISTA_CANCELAR_GASTO } from './textos';

/**
 * Confirmación de un gasto compartido dictado (`02 §27`): si hay varios grupos abiertos y no quedó claro con
 * quién, primero lo pregunta; luego el formulario de siempre con lo dictado y su resumen.
 */
export function TarjetaConfirmarCompartido({
  propuesta,
  alGuardar,
  alCancelar,
}: {
  propuesta: PropuestaGastoCompartido;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [grupoId, setGrupoId] = useState<string | null>(propuesta.grupoId);
  const grupo = propuesta.grupos.find((g) => g.id === grupoId);
  if (!grupo) {
    return (
      <Tarjeta testID="confirmar-compartido-grupo">
        <Texto variante="subtitulo" testID="confirmar-compartido-titulo" accessibilityRole="header">
          {ETIQUETA_CON_QUIEN_COMPARTES}
        </Texto>
        <Chips
          testID="confirmar-compartido-grupo"
          opciones={propuesta.grupos.map((g) => ({ valor: g.id, etiqueta: g.nombre }))}
          valor={null}
          alCambiar={setGrupoId}
        />
        <Boton
          etiqueta={BTN_CANCELAR}
          variante="texto"
          pista={PISTA_CANCELAR_GASTO}
          alPresionar={alCancelar}
          testID="confirmar-compartido-cancelar"
        />
      </Tarjeta>
    );
  }
  return (
    <FormularioGastoCompartido
      grupoId={grupo.id}
      nombrePareja={grupo.nombre}
      prellenado={propuesta}
      alGuardar={alGuardar}
      alCancelar={alCancelar}
    />
  );
}
