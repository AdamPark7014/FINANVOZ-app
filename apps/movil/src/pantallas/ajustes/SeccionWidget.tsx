import { useState } from 'react';
import { Platform } from 'react-native';
import { fijarOcultarMontosWidget, obtenerAjustesWidget } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Interruptor, Tarjeta, Texto } from '../../ui';

/**
 * Ajustes → Widget (`02 §21`, Gratis): "Ocultar montos" cambia "Hoy puedes $214 · 4 días" por "Toca para ver tu
 * día". Encendido por omisión si el bloqueo biométrico está activo. Solo Android (el widget de iPhone es v2).
 */
export function SeccionWidget() {
  const { ctx, refrescar } = useSesion();
  const { ocultarMontos } = useVista(obtenerAjustesWidget);
  const [error, setError] = useState(false);
  if (Platform.OS !== 'android') return null;
  return (
    <Tarjeta testID="ajustes-widget">
      <Texto variante="subtitulo">Widget</Texto>
      <Texto variante="secundario" tono="secundario">
        Agrégalo desde la pantalla de inicio de tu teléfono: deja presionado un espacio vacío y busca
        Finanvoz.
      </Texto>
      <Interruptor
        testID="ajustes-widget-ocultar"
        etiqueta="Ocultar montos"
        descripcion="El widget dice “Toca para ver tu día” en lugar de cuánto puedes gastar."
        valor={ocultarMontos}
        alCambiar={(valor) => {
          try {
            fijarOcultarMontosWidget(ctx, valor);
            setError(false);
            refrescar();
          } catch {
            setError(true);
          }
        }}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          No pude guardar el cambio. Intenta de nuevo.
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
