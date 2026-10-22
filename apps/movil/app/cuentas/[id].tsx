import { useLocalSearchParams, useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaDetalleCuenta } from '../../src/pantallas/cuentas';
import { paramsDeFiltro } from '../../src/pantallas/principal';

/** Detalle de una cuenta de Tienes (`02 §11`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleCuentaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <PantallaDetalleCuenta
      key={id}
      cuentaId={String(id)}
      alVolver={volver}
      alVerMovimientos={(cuentaId) =>
        router.navigate({ pathname: '/movimientos', params: paramsDeFiltro({ cuentaId }) })
      }
      alContarEfectivo={(cuentaId) => abrirArqueo(router, { cuentaId })}
    />
  );
}
