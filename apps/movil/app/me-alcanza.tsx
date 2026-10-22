import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  DESCRIPCION_PUERTA_PLUS,
  INVITACION_PRUEBA_PLUS,
  PantallaMeAlcanza,
  TITULO_PUERTA_PLUS,
  tomarConsultaPendiente,
} from '../src/pantallas/me-alcanza';
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
      {/* Plus (`02 §9`): en Gratis, qué hace y, solo si hay tienda, cómo probarlo. */}
      <PuertaPlus
        funcion="meAlcanza"
        titulo={TITULO_PUERTA_PLUS}
        descripcion={DESCRIPCION_PUERTA_PLUS}
        invitacion={INVITACION_PRUEBA_PLUS}
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
