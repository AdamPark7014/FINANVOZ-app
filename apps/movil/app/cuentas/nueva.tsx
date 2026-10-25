import { Stack, useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaNuevaCuenta } from '../../src/pantallas/cuentas';
import { TITULO_NUEVA_CUENTA } from '../../src/pantallas/cuentas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Tienes › Agregar cuenta (`02 §11`): al guardar regresa a Cuentas con «Listo: agregué…». */
export default function NuevaCuentaRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_NUEVA_CUENTA)} />
      <PantallaNuevaCuenta
        alGuardar={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
      />
    </>
  );
}
