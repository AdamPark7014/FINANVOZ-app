import { useRouter } from 'expo-router';
import { useState } from 'react';
import { PantallaMeAlcanza, tomarConsultaPendiente } from '../src/pantallas/me-alcanza';
import { PuertaPlus } from '../src/pantallas/plan';
import { ProveedorAvisos } from '../src/pantallas/principal';

/** "¿Me alcanza?" (`02 §9`): desde el botón de Hoy o diciendo "¿me alcanza para…?". */
export default function MeAlcanza() {
  const router = useRouter();
  // La consulta dicha viaja en memoria, nunca en la ruta (regla 9).
  const [inicial] = useState(tomarConsultaPendiente);
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return (
    <ProveedorAvisos>
      {/* Plus (`02 §9`): en Gratis, qué hace y cómo probarlo. */}
      <PuertaPlus
        funcion="meAlcanza"
        titulo="¿Me alcanza? es de Plus"
        descripcion="Compara pagar de contado, a meses o esperar, y te dice con qué probabilidad llegas a tu próximo pago. Pruébalo 14 días gratis."
        alVolver={cerrar}
      >
        <PantallaMeAlcanza
          {...(inicial ? { consultaInicial: inicial } : {})}
          alCerrar={cerrar}
          alVerMovimientos={() => router.navigate('/movimientos')}
        />
      </PuertaPlus>
    </ProveedorAvisos>
  );
}
