import { useState } from 'react';
import { View } from 'react-native';
import { listarTandas, type TandaCreada } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Pantalla, Texto } from '../../ui';
import { Fila, Grupo } from '../../ui/componentes/Lista';
import { EstadoVacio } from '../principal/EstadoVacio';
import { FormularioTanda } from './FormularioTanda';
import {
  ETIQUETA_NUEVA_TANDA,
  ETIQUETA_VER_CALENDARIO,
  ETIQUETA_VOLVER,
  etiquetaAccesibleTandaEnLista,
  etiquetaVacioTandas,
  PISTA_NUEVA_TANDA,
  PISTA_VACIO_TANDAS,
  PISTA_VER_CALENDARIO,
  PISTA_VOLVER,
  TEXTO_TANDAS_VACIO,
  TITULO_TANDAS,
  textoEnRiesgo,
  textoSubtituloListaConProxima,
  textoSubtituloListaSinProxima,
} from './textos';
import { ESTILO_TITULO_PANTALLA } from '../../ui/componentes/Lista';

/**
 * Cuentas → Tandas (`02 §18`, gratis): tus tandas con su próxima aportación y lo que arriesgas, y "Nueva tanda"
 * con el formulario. Tocar una abre su detalle.
 */
export function PantallaTandas({
  alVolver,
  alAbrirTanda,
  nuevaAlInicio = false,
}: {
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  alAbrirTanda: (tandaId: string) => void;
  nuevaAlInicio?: boolean;
}) {
  const tandas = useVista(listarTandas);
  const [nueva, setNueva] = useState(nuevaAlInicio);
  const botonNueva = (
    <Boton
      testID="tandas-nueva"
      etiqueta={ETIQUETA_NUEVA_TANDA}
      alPresionar={() => setNueva(true)}
      pista={PISTA_NUEVA_TANDA}
    />
  );
  return (
    <Pantalla
      testID="pantalla-tandas"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {alVolver ? (
        <Boton
          testID="tandas-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
        />
      ) : null}
      <Texto
        variante="titulo"
        testID="tandas-titulo"
        accessibilityRole="header"
        style={ESTILO_TITULO_PANTALLA}
      >
        {TITULO_TANDAS}
      </Texto>
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
            <EstadoVacio
              icono="personas"
              texto={TEXTO_TANDAS_VACIO}
              testID="tandas-vacio"
              etiquetaAccesible={etiquetaVacioTandas()}
              pistaCta={PISTA_VACIO_TANDAS}
            >
              {botonNueva}
            </EstadoVacio>
          ) : null}
          <View accessibilityRole="list" testID="tandas-lista">
            {tandas.length > 0 ? (
              <Grupo sangria>
                {/* Toda la fila abre el detalle (antes solo "Ver calendario", abajo y pequeño). */}
                {tandas.map((t) => (
                  <Fila
                    key={t.id}
                    testID={`tanda-${t.id}`}
                    icono="personas"
                    familia="antojos"
                    titulo={t.nombre}
                    apoyo={
                      t.proxima
                        ? textoSubtituloListaConProxima(t.aportacion, t.proxima.etiqueta, t.etiquetaCobro)
                        : textoSubtituloListaSinProxima(t.etiquetaCobro)
                    }
                    alPresionar={() => alAbrirTanda(t.id)}
                    etiquetaAccesible={etiquetaAccesibleTandaEnLista(t)}
                    pista={PISTA_VER_CALENDARIO}
                    pie={
                      <>
                        <Texto variante="secundario">{textoEnRiesgo(t.enRiesgo)}</Texto>
                        <Texto variante="etiqueta" tono="acento" testID={`tanda-${t.id}-abrir`}>
                          {ETIQUETA_VER_CALENDARIO}
                        </Texto>
                      </>
                    }
                  />
                ))}
              </Grupo>
            ) : null}
          </View>
          {tandas.length > 0 ? botonNueva : null}
        </>
      )}
    </Pantalla>
  );
}
