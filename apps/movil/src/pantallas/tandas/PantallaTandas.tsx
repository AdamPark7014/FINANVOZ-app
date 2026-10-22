import { useState } from 'react';
import { View } from 'react-native';
import { listarTandas, type TandaCreada } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
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
        pista={PISTA_VOLVER}
      />
      <Texto variante="titulo" testID="tandas-titulo" accessibilityRole="header">
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
              texto={TEXTO_TANDAS_VACIO}
              testID="tandas-vacio"
              etiquetaAccesible={etiquetaVacioTandas()}
              pistaCta={PISTA_VACIO_TANDAS}
            />
          ) : null}
          <View accessibilityRole="list" testID="tandas-lista" style={{ gap: espacio.s }}>
            {/* Toda la tarjeta abre el detalle (antes solo "Ver calendario", abajo y pequeño). */}
            {tandas.map((t) => (
              <Tarjeta
                key={t.id}
                testID={`tanda-${t.id}`}
                alPresionar={() => alAbrirTanda(t.id)}
                etiquetaAccesible={etiquetaAccesibleTandaEnLista(t)}
                pista={PISTA_VER_CALENDARIO}
              >
                <View style={{ gap: espacio.xxs }}>
                  <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
                  <Texto variante="secundario" tono="secundario">
                    {t.proxima
                      ? textoSubtituloListaConProxima(t.aportacion, t.proxima.etiqueta, t.etiquetaCobro)
                      : textoSubtituloListaSinProxima(t.etiquetaCobro)}
                  </Texto>
                  <Texto variante="secundario">{textoEnRiesgo(t.enRiesgo)}</Texto>
                </View>
                <Texto variante="etiqueta" tono="acento" testID={`tanda-${t.id}-abrir`}>
                  {`${ETIQUETA_VER_CALENDARIO} ›`}
                </Texto>
              </Tarjeta>
            ))}
          </View>
          <Boton
            testID="tandas-nueva"
            etiqueta={ETIQUETA_NUEVA_TANDA}
            alPresionar={() => setNueva(true)}
            pista={PISTA_NUEVA_TANDA}
          />
        </>
      )}
    </Pantalla>
  );
}
