import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTarjeta } from '../../src/pantallas/tarjetas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Detalle de una tarjeta (`02 §8`). Solo el id (y `pagar=1` desde «Pagar» de Cuentas) viaja en la ruta (regla 9). */
export default function DetalleTarjetaRuta() {
  const router = useRouter();
  const { id, pagar } = useLocalSearchParams<{ id: string; pagar?: string }>();
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <ProveedorAvisos>
        <PantallaTarjeta
          key={id}
          tarjetaId={String(id)}
          pagarAlAbrir={pagar === '1'}
          alLeerEstadoPdf={
            // Solo Android lee PDF por ahora (M15); en iPhone sería PDFKit (`07 §8`).
            Platform.OS === 'android'
              ? () => router.push({ pathname: '/estado-cuenta', params: { tarjeta: String(id) } })
              : undefined
          }
        />
      </ProveedorAvisos>
    </>
  );
}
