import { useLocalSearchParams, useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaDetallePagoFijo } from '../../src/pantallas/cuentas';

/** Detalle de un compromiso: cambiar monto o quitarlo. Solo el id viaja en la ruta (regla 9). */
export default function DetallePagoFijoRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <PantallaDetallePagoFijo
      key={id}
      programadoId={String(id)}
      alVolver={volver}
      alQuitado={(confirmacion) => {
        dejarConfirmacion(confirmacion);
        volver();
      }}
      alAbrirTarjeta={(tarjetaId) => router.push({ pathname: '/tarjetas/[id]', params: { id: tarjetaId } })}
      alAbrirTanda={(tandaId) => router.push({ pathname: '/tandas/[id]', params: { id: tandaId } })}
      alAbrirSuscripciones={() => router.push('/suscripciones')}
    />
  );
}
