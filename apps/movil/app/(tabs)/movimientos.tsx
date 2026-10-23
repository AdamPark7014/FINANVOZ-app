import { useContext } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { View } from 'react-native';
import {
  detalleDeParams,
  filtroDeParams,
  PantallaMovimientos,
  type ParamsMovimientos,
} from '../../src/pantallas/principal';
import { useInformarAltoPestanas } from '../../src/pantallas/principal/ProveedorAvisos';
import { propsContenedorPestana } from '../../src/rutas/pestanas-textos';

/** Pestaña Movimientos (`02 §10`): filtro y detalle solo vía parámetros de ruta (regla 9). */
export default function Movimientos() {
  const router = useRouter();
  useInformarAltoPestanas(useContext(BottomTabBarHeightContext));
  const params = useLocalSearchParams<ParamsMovimientos>();
  const filtro = filtroDeParams(params);
  const detalle = detalleDeParams(params);
  return (
    <View style={{ flex: 1 }} {...propsContenedorPestana('movimientos')}>
      <PantallaMovimientos
        filtro={filtro}
        detalleInicial={detalle}
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
    </View>
  );
}
