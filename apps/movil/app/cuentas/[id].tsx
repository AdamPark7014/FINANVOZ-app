import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaDetalleCuenta } from '../../src/pantallas/cuentas';
import { ETIQUETA_TIENES } from '../../src/pantallas/cuentas/textos';
import { paramsDeFiltro } from '../../src/pantallas/principal';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Detalle de una cuenta de Tienes (`02 §11`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleCuentaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(ETIQUETA_TIENES)} />
      <PantallaDetalleCuenta
        key={id}
        cuentaId={String(id)}
        alVerMovimientos={(cuentaId) =>
          router.navigate({ pathname: '/movimientos', params: paramsDeFiltro({ cuentaId }) })
        }
        alContarEfectivo={(cuentaId) => abrirArqueo(router, { cuentaId })}
      />
    </>
  );
}
