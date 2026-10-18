import { useLocalSearchParams, useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaRegistrar, paramsDeDetalle, paramsDeFiltro } from '../../src/pantallas/principal';

export default function Registrar() {
  const router = useRouter();
  // Solo el id de una frase de "Por revisar" viaja en la ruta, nunca su texto (regla 9).
  const { frase } = useLocalSearchParams<{ frase?: string }>();
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return (
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
      />
    </ProveedorCompartido>
  );
}
