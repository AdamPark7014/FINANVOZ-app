import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaDetallePagoFijo } from '../../src/pantallas/cuentas';
import { TITULO_PAGOS_FIJOS } from '../../src/pantallas/cuentas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Detalle de un compromiso: cambiar monto o quitarlo. Solo el id viaja en la ruta (regla 9). */
export default function DetallePagoFijoRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PAGOS_FIJOS)} />
      <PantallaDetallePagoFijo
        key={id}
        programadoId={String(id)}
        alQuitado={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
        alAbrirTarjeta={(tarjetaId) => router.push({ pathname: '/tarjetas/[id]', params: { id: tarjetaId } })}
        alAbrirTanda={(tandaId) => router.push({ pathname: '/tandas/[id]', params: { id: tandaId } })}
        alAbrirSuscripciones={() => router.push('/suscripciones')}
      />
    </>
  );
}
