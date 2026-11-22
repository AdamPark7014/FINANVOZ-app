import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { construirVistaWidget, fijarOcultarMontosWidget, obtenerAjustesWidget } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { espacio, Texto, useTema } from '../../ui';
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
import { CeldaGrupo, FilaInterruptor, Grupo } from '../../ui/componentes/Lista';

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
  const vistaPrevia = useMemo(() => construirVistaWidget(EJEMPLO_HOY, { ocultarMontos }), [ocultarMontos]);

  if (Platform.OS !== 'android') return null;

  return (
    <Grupo testID="ajustes-widget" titulo={SECCION_WIDGET} testIDTitulo="ajustes-widget-titulo">
      <CeldaGrupo>
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
      </CeldaGrupo>
      <FilaInterruptor
        testID="ajustes-widget-ocultar"
        titulo={ETIQUETA_OCULTAR}
        apoyo={DESC_OCULTAR}
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
      {error ? (
        <CeldaGrupo>
          <Texto
            variante="secundario"
            tono="faltante"
            testID="ajustes-widget-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {MENSAJE_NO_GUARDAR}
          </Texto>
        </CeldaGrupo>
      ) : null}
    </Grupo>
  );
}
