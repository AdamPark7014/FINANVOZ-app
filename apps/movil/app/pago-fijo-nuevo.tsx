import { useRouter } from 'expo-router';
import { FormularioPagoFijo } from '../src/pantallas/pagos-fijos/FormularioPagoFijo';
import { AYUDA_PAGO_FIJO_NUEVO, BTN_LISTO, TITULO_PAGO_FIJO_NUEVO } from '../src/pantallas/principal/textos';
import { Boton, Pantalla, Texto } from '../src/ui';

/**
 * Cuentas → «Agregar pago fijo»: el mismo formulario del onboarding (O5). Al guardar vuelve a Cuentas, donde el
 * pago aparece en Compromisos si toca en los próximos 30 días.
 */
export default function PagoFijoNuevoRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <Pantalla testID="pantalla-pago-fijo-nuevo" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto variante="titulo" accessibilityRole="header">
        {TITULO_PAGO_FIJO_NUEVO}
      </Texto>
      <Texto variante="secundario" tono="secundario">
        {AYUDA_PAGO_FIJO_NUEVO}
      </Texto>
      <FormularioPagoFijo testID="pago-nuevo" alAgregado={volver} />
      <Boton testID="pago-nuevo-cerrar" variante="texto" etiqueta={BTN_LISTO} alPresionar={volver} />
    </Pantalla>
  );
}
