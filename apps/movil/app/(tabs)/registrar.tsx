import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaRegistrar, paramsDeDetalle, paramsDeFiltro } from '../../src/pantallas/principal';
import { propsContenedorRegistrar } from './pestanas-textos';

/** Ruta Registrar (sin pestaña): dictado, texto y formulario (`02 §2`). */
export default function Registrar() {
  const router = useRouter();
  // Solo el id de una frase de "Por revisar" viaja en la ruta, nunca su texto (regla 9).
  const { frase, dictar } = useLocalSearchParams<{ frase?: string; dictar?: string }>();
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return (
    <View style={{ flex: 1 }} {...propsContenedorRegistrar()}>
      <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
        <PantallaRegistrar
          // `key`: revisar otra frase vuelve a montar el panel.
          key={frase ?? 'nueva'}
          alCerrar={cerrar}
          alVerMovimientos={(filtro) =>
            router.navigate({ pathname: '/movimientos', params: paramsDeFiltro(filtro) })
          }
          alVerMovimiento={(transaccionId) =>
            router.navigate({ pathname: '/movimientos', params: paramsDeDetalle(transaccionId) })
          }
          alArqueo={(efectivoReal) => abrirArqueo(router, { efectivoReal })}
          alMeAlcanza={(consulta) => abrirMeAlcanza(router, consulta)}
          {...(typeof frase === 'string' && frase !== '' ? { fraseRevision: frase } : {})}
          // Micrófono del widget (`finanvoz:///registrar?dictar=1`): escucha al abrir.
          dictarAlAbrir={dictar === '1'}
        />
      </ProveedorCompartido>
    </View>
  );
}
