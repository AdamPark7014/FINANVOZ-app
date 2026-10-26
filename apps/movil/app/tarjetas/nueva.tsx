import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { tomarPrellenado } from '../../src/asistente/flujos';
import { FormularioTarjetaNueva } from '../../src/pantallas/tarjetas';
import { espacio, Pantalla, Texto } from '../../src/ui';
import { BarraNativa } from '../../src/ui/navegacion';

const TITULO_NUEVA_TARJETA = 'Tarjeta de crédito';

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
    <>
      <BarraNativa salida="/cuentas" />
      <Pantalla
        testID="pantalla-tarjeta-nueva"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <Texto variante="titulo" accessibilityRole="header">
          {TITULO_NUEVA_TARJETA}
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
    </>
  );
}
