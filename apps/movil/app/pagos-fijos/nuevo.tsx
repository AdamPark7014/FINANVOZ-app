import { Stack, useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaNuevoPagoFijo } from '../../src/pantallas/cuentas';
import { TITULO_NUEVO_PAGO } from '../../src/pantallas/cuentas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Compromisos › Agregar pago fijo (`02 §11`): al guardar regresa con «Listo: agregué…». */
export default function NuevoPagoFijoRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_NUEVO_PAGO)} />
      <PantallaNuevoPagoFijo
        alGuardar={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
      />
    </>
  );
}
