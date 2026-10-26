import { useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaNuevoPagoFijo } from '../../src/pantallas/cuentas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Compromisos › Agregar pago fijo (`02 §11`): al guardar regresa con «Listo: agregué…». */
export default function NuevoPagoFijoRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <PantallaNuevoPagoFijo
        alGuardar={(confirmacion) => {
          dejarConfirmacion(confirmacion);
          volver();
        }}
      />
    </>
  );
}
