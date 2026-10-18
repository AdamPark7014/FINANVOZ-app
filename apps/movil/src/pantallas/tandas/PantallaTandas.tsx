import { useState } from 'react';
import { listarTandas, type TandaCreada } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, Pantalla, Tarjeta, Texto } from '../../ui';
import { FormularioTanda } from './FormularioTanda';
import {
  ETIQUETA_NUEVA_TANDA,
  ETIQUETA_VER_CALENDARIO,
  ETIQUETA_VOLVER,
  TEXTO_TANDAS_VACIO,
  TITULO_TANDAS,
  textoEnRiesgo,
  textoSubtituloListaConProxima,
  textoSubtituloListaSinProxima,
} from './textos';

/**
 * Cuentas → Tandas (`02 §18`, gratis): tus tandas con su próxima aportación y lo que arriesgas, y "Nueva tanda"
 * con el formulario. Tocar una abre su detalle.
 */
export function PantallaTandas({
  alVolver,
  alAbrirTanda,
  nuevaAlInicio = false,
}: {
  alVolver: () => void;
  alAbrirTanda: (tandaId: string) => void;
  nuevaAlInicio?: boolean;
}) {
  const tandas = useVista(listarTandas);
  const [nueva, setNueva] = useState(nuevaAlInicio);
  return (
    <Pantalla testID="pantalla-tandas" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="tandas-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Tandas</Texto>
      {nueva ? (
        <FormularioTanda
          alGuardar={(t: TandaCreada) => {
            setNueva(false);
            alAbrirTanda(t.tandaId);
          }}
          alCancelar={() => setNueva(false)}
        />
      ) : (
        <>
          {tandas.length === 0 ? (
            <Texto variante="cuerpo" tono="secundario" testID="tandas-vacio">
              {TEXTO_TANDAS_VACIO}
            </Texto>
          ) : null}
          {tandas.map((t) => (
            <Tarjeta key={t.id} testID={`tanda-${t.id}`}>
              <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
              <Texto variante="secundario" tono="secundario">
                {t.proxima
                  ? `${formatearCentavos(t.aportacion)} el ${t.proxima.etiqueta} · cobras el ${t.etiquetaCobro}`
                  : `Ya diste todas tus aportaciones · cobras el ${t.etiquetaCobro}`}
              </Texto>
              <Texto variante="secundario">{textoEnRiesgo(t.enRiesgo)}</Texto>
              <Boton
                testID={`tanda-${t.id}-abrir`}
                etiqueta="Ver calendario"
                variante="texto"
                ancho="contenido"
                alPresionar={() => alAbrirTanda(t.id)}
              />
            </Tarjeta>
          ))}
          <Boton testID="tandas-nueva" etiqueta="Nueva tanda" alPresionar={() => setNueva(true)} />
        </>
      )}
    </Pantalla>
  );
}
