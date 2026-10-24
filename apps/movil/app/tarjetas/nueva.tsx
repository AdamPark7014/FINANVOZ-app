import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { tomarPrellenado } from '../../src/asistente/flujos';
import { FormularioTarjetaNueva } from '../../src/pantallas/tarjetas';
import { BTN_VOLVER, PISTA_VOLVER, PISTA_VOLVER_COMPRA_MSI } from '../../src/pantallas/tarjetas/textos';
import { Boton, espacio, Pantalla, Texto } from '../../src/ui';

/**
 * Cuentas → "Agregar tarjeta": el mismo formulario del onboarding (O4); al guardar abre su detalle. Desde una
 * compra a meses sin tarjetas (`volver=1`) regresa a la compra, que ya la muestra para elegirla. Desde el flujo
 * conversacional de tarjeta («Cambiar algo») llega con lo ya dicho, en memoria (regla 9).
 */
export default function NuevaTarjetaRuta() {
  const router = useRouter();
  const { volver } = useLocalSearchParams<{ volver?: string }>();
  const [prellenado] = useState(() => tomarPrellenado('tarjeta'));
  const salir = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <Pantalla
      testID="pantalla-tarjeta-nueva"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      <Boton
        testID="tarjeta-nueva-volver"
        etiqueta={BTN_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={salir}
        pista={volver === '1' ? PISTA_VOLVER_COMPRA_MSI : PISTA_VOLVER}
      />
      <Texto variante="titulo" accessibilityRole="header">
        Tarjeta de crédito
      </Texto>
      <FormularioTarjetaNueva
        prellenado={prellenado}
        alGuardar={(t) =>
          volver === '1' && router.canGoBack()
            ? router.back()
            : router.replace({ pathname: '/tarjetas/[id]', params: { id: t.cuentaId } })
        }
        alCancelar={salir}
      />
    </Pantalla>
  );
}
