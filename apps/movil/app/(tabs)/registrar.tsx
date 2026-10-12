import { useLocalSearchParams, useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaRegistrar, paramsDeFiltro } from '../../src/pantallas/principal';

export default function Registrar() {
  const router = useRouter();
  // Solo el id de una frase de "Por revisar" viaja en la ruta, nunca su texto (regla 9).
  const { frase } = useLocalSearchParams<{ frase?: string }>();
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return (
    <PantallaRegistrar
      // `key`: revisar otra frase vuelve a montar el panel.
      key={frase ?? 'nueva'}
      alCerrar={cerrar}
      alVerMovimientos={(filtro) =>
        router.navigate({ pathname: '/movimientos', params: paramsDeFiltro(filtro) })
      }
      alArqueo={(efectivoReal) => abrirArqueo(router, { efectivoReal })}
      alMeAlcanza={(consulta) => abrirMeAlcanza(router, consulta)}
      {...(typeof frase === 'string' && frase !== '' ? { fraseRevision: frase } : {})}
    />
  );
}
