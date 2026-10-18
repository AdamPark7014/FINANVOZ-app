import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { construirVistaWidget, fijarOcultarMontosWidget, obtenerAjustesWidget } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { espacio, Interruptor, Tarjeta, Texto, useTema } from '../../ui';
import { PreviaWidget } from '../../widget/PreviaWidget';
import { MENSAJE_NO_GUARDAR } from './textos';
import {
  DESC_OCULTAR,
  ETIQUETA_OCULTAR,
  ETIQUETA_PREVIA,
  PISTA_OCULTAR_MONTOS,
  PISTA_PREVIA,
  PISTA_PREVIA_OCULTA,
  SECCION_WIDGET,
  TEXTO_INSTRUCCION,
} from './widget-textos';

/** Datos de ejemplo (misma línea que la semilla e4-01 y `VISTA_EJEMPLO_WIDGET`). */
const EJEMPLO_HOY = { estado: 'normal' as const, hoyPuedesPesos: 214, dias: 4 };

/**
 * Ajustes → Widget (`02 §21`, Gratis): "Ocultar montos" cambia "Hoy puedes $214 · 4 días" por "Toca para ver tu
 * día". Encendido por omisión si el bloqueo biométrico está activo. Solo Android (el widget de iPhone es v2).
 */
export function SeccionWidget() {
  const { ctx, refrescar } = useSesion();
  const { esquema } = useTema();
  const { ocultarMontos } = useVista(obtenerAjustesWidget);
  const [error, setError] = useState(false);
  const vistaPrevia = useMemo(
    () => construirVistaWidget(EJEMPLO_HOY, { ocultarMontos }),
    [ocultarMontos],
  );

  if (Platform.OS !== 'android') return null;

  return (
    <Tarjeta testID="ajustes-widget">
      <Texto variante="subtitulo" testID="ajustes-widget-titulo" accessibilityRole="header">
        {SECCION_WIDGET}
      </Texto>
      <Texto variante="secundario" tono="secundario" testID="ajustes-widget-instrucciones">
        {TEXTO_INSTRUCCION}
      </Texto>
      <Texto
        variante="etiqueta"
        testID="ajustes-widget-previa-etiqueta"
        accessibilityRole="header"
        style={{ marginTop: espacio.m }}
      >
        {ETIQUETA_PREVIA}
      </Texto>
      <View testID="ajustes-widget-previa" style={{ marginTop: espacio.xs }}>
        <PreviaWidget
          vista={vistaPrevia}
          esquema={esquema}
          pistaAccesible={ocultarMontos ? PISTA_PREVIA_OCULTA : PISTA_PREVIA}
        />
      </View>
      <View style={{ marginTop: espacio.m }}>
        <Interruptor
          testID="ajustes-widget-ocultar"
          etiqueta={ETIQUETA_OCULTAR}
          descripcion={DESC_OCULTAR}
          pista={PISTA_OCULTAR_MONTOS}
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
      </View>
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="ajustes-widget-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {MENSAJE_NO_GUARDAR}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
