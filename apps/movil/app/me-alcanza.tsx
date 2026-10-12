import { useRouter } from 'expo-router';
import { useState } from 'react';
import { PantallaMeAlcanza, tomarConsultaPendiente } from '../src/pantallas/me-alcanza';
import { ProveedorAvisos } from '../src/pantallas/principal';

/** "¿Me alcanza?" (`02 §9`): desde el botón de Hoy o diciendo "¿me alcanza para…?". */
export default function MeAlcanza() {
  const router = useRouter();
  // La consulta dicha viaja en memoria, nunca en la ruta (regla 9).
  const [inicial] = useState(tomarConsultaPendiente);
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return (
    <ProveedorAvisos>
      <PantallaMeAlcanza
        {...(inicial ? { consultaInicial: inicial } : {})}
        alCerrar={cerrar}
        alVerMovimientos={() => router.navigate('/movimientos')}
      />
    </ProveedorAvisos>
  );
}
