import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  BTN_DOCK_BUSCAR,
  ETIQUETA_CERRAR_BUSQUEDA,
  ETIQUETA_DOCK_HABLAR_MOVIMIENTOS,
  PISTA_DOCK_BUSCAR,
} from '../../src/pantallas/asistente/textos';
import { DockSeccion } from '../../src/pantallas/navegacion/DockSeccion';
import { useMedidasDock } from '../../src/pantallas/navegacion/DockVoz';
import {
  detalleDeParams,
  filtroDeParams,
  PantallaMovimientos,
  type ParamsMovimientos,
} from '../../src/pantallas/principal';
import { propsContenedorPestana } from '../../src/rutas/pestanas-textos';

/**
 * Movimientos (`02 §10`): filtro y detalle solo vía parámetros de ruta (regla 9). Al pie, el dock de voz con
 * «Buscar» (dirección B).
 */
export default function Movimientos() {
  const router = useRouter();
  const params = useLocalSearchParams<ParamsMovimientos>();
  const filtro = filtroDeParams(params);
  const detalle = detalleDeParams(params);
  const [buscando, setBuscando] = useState(false);
  const { ocupado } = useMedidasDock();
  return (
    <View style={{ flex: 1 }} {...propsContenedorPestana('movimientos')}>
      <PantallaMovimientos
        filtro={filtro}
        detalleInicial={detalle}
        buscando={buscando}
        espacioInferior={ocupado}
        {...(filtro
          ? {
              alQuitarFiltro: () => {
                router.setParams({
                  desde: undefined,
                  hasta: undefined,
                  categorias: undefined,
                  cuenta: undefined,
                  gastos: undefined,
                  detalle: undefined,
                });
              },
            }
          : {})}
        alRegistrar={() => router.navigate('/registrar')}
        alRevisar={(id) => router.navigate({ pathname: '/registrar', params: { frase: id } })}
        alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })}
      />
      <DockSeccion
        prefijoTestID="dock-movimientos"
        etiquetaHablar={ETIQUETA_DOCK_HABLAR_MOVIMIENTOS}
        derecha={{
          etiqueta: BTN_DOCK_BUSCAR,
          icono: 'buscar',
          alPresionar: () => setBuscando((b) => !b),
          testID: 'boton-buscar',
          etiquetaAccesible: buscando ? ETIQUETA_CERRAR_BUSQUEDA : BTN_DOCK_BUSCAR,
          ...(buscando ? {} : { pista: PISTA_DOCK_BUSCAR }),
          abierto: buscando,
        }}
      />
    </View>
  );
}
