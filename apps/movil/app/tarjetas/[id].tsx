import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTarjeta } from '../../src/pantallas/tarjetas';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Detalle de una tarjeta (`02 §8`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleTarjetaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa('Tarjetas')} />
      <ProveedorAvisos>
        <PantallaTarjeta
          key={id}
          tarjetaId={String(id)}
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
