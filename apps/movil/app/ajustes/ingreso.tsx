import { useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { EditarIngreso } from '../../src/pantallas/ajustes/EditarIngreso';
import { BarraNativa } from '../../src/ui/navegacion';

/** Ajustes › Ingreso: se abre desde Ajustes y desde "Configurar mi ingreso" en Hoy, y regresa ahí. */
export default function AjustesIngreso() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <>
      <BarraNativa salida="/hoy" />
      <EditarIngreso
        alGuardar={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
      />
    </>
  );
}
