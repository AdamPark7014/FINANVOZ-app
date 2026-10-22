import { useRouter } from 'expo-router';
import { dejarConfirmacion } from '../../src/pantallas/ajustes/confirmacion';
import { PantallaNuevaCuenta } from '../../src/pantallas/cuentas';

/** Cuentas › Tienes › Agregar cuenta (`02 §11`): al guardar regresa a Cuentas con «Listo: agregué…». */
export default function NuevaCuentaRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <PantallaNuevaCuenta
      alVolver={volver}
      alGuardar={(confirmacion) => {
        dejarConfirmacion(confirmacion);
        volver();
      }}
    />
  );
}
