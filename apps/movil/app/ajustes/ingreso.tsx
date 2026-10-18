import { useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { EditarIngreso } from '../../src/pantallas/ajustes/EditarIngreso';

/** Ajustes › Ingreso: se abre desde Ajustes y desde "Decir cada cuándo me pagan" en Hoy, y regresa ahí. */
export default function AjustesIngreso() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <EditarIngreso
      alVolver={volver}
      alGuardar={(confirmacion) => {
        dejarConfirmacion(confirmacion);
        volver();
      }}
    />
  );
}
