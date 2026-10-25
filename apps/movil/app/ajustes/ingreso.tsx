import { Stack, useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { EditarIngreso } from '../../src/pantallas/ajustes/EditarIngreso';
import { TITULO_EDITAR } from '../../src/pantallas/ajustes/ingreso-textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Ajustes › Ingreso: se abre desde Ajustes y desde "Configurar mi ingreso" en Hoy, y regresa ahí. */
export default function AjustesIngreso() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_EDITAR)} />
      <EditarIngreso
        alGuardar={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
      />
    </>
  );
}
