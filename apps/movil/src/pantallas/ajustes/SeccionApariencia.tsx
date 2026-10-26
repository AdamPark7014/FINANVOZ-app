import { useState } from 'react';
import { View } from 'react-native';
import { APARIENCIAS, fijarApariencia, obtenerApariencia, type Apariencia } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  aplicarApariencia,
  Boton,
  espacio,
  etiquetaFilaAjuste,
  FilaAjuste,
  GrupoChips,
  OCULTAR_ETIQUETA_VISIBLE,
  Tarjeta,
  Texto,
} from '../../ui';
import {
  BTN_CAMBIAR_APARIENCIA,
  BTN_LISTO_APARIENCIA,
  DESC_APARIENCIA_SISTEMA,
  ETIQUETAS_APARIENCIA,
  PISTA_CAMBIAR_APARIENCIA,
  PISTA_LISTO_APARIENCIA,
  PREGUNTA_APARIENCIA,
  SECCION_APARIENCIA,
} from './apariencia-textos';
import { MENSAJE_NO_GUARDAR } from './textos';

const OPCIONES = APARIENCIAS.map((a) => ({ valor: a, etiqueta: ETIQUETAS_APARIENCIA[a] }));

/**
 * Ajustes › Apariencia (`02 §16`): claro por omisión aunque el teléfono esté en oscuro; oscuro o «Como el
 * teléfono» solo si la persona lo elige. Cerrada es una fila de Ajustes (`PLAN-UX-VOZ` §3.6), como Colchón: tocarla
 * abre las tres opciones aquí mismo y cada toque se guarda y se aplica al momento.
 */
export function SeccionApariencia() {
  const { ctx, refrescar } = useSesion();
  const apariencia = useVista(obtenerApariencia);
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState(false);

  const elegir = (nueva: Apariencia) => {
    try {
      fijarApariencia(ctx, nueva);
    } catch {
      setError(true);
      return;
    }
    setError(false);
    aplicarApariencia(nueva);
    refrescar();
  };

  const valor = ETIQUETAS_APARIENCIA[apariencia];
  const textoError = error ? (
    <Texto
      variante="secundario"
      tono="faltante"
      testID="ajustes-apariencia-error"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {MENSAJE_NO_GUARDAR}
    </Texto>
  ) : null;

  if (!abierta) {
    return (
      <View testID="ajustes-apariencia" style={{ gap: espacio.s }}>
        <FilaAjuste
          testID="ajustes-cambiar-apariencia"
          testIDTitulo="ajustes-apariencia-titulo"
          testIDValor="ajustes-apariencia-valor"
          tituloEsEncabezado
          titulo={SECCION_APARIENCIA}
          valor={valor}
          pista={PISTA_CAMBIAR_APARIENCIA}
          etiquetaAccesible={etiquetaFilaAjuste(SECCION_APARIENCIA, valor, BTN_CAMBIAR_APARIENCIA)}
          alPresionar={() => {
            setError(false);
            setAbierta(true);
          }}
        />
        {textoError}
      </View>
    );
  }

  return (
    <Tarjeta testID="ajustes-apariencia">
      <Texto variante="subtitulo" testID="ajustes-apariencia-titulo" accessibilityRole="header">
        {SECCION_APARIENCIA}
      </Texto>
      <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
        {PREGUNTA_APARIENCIA}
      </Texto>
      <GrupoChips
        prefijoTestID="ajustes-apariencia"
        etiqueta={PREGUNTA_APARIENCIA}
        opciones={OPCIONES}
        valor={apariencia}
        alCambiar={elegir}
      />
      <Texto variante="secundario" tono="secundario">
        {DESC_APARIENCIA_SISTEMA}
      </Texto>
      {textoError}
      <Boton
        testID="ajustes-apariencia-cerrar"
        variante="texto"
        ancho="contenido"
        etiqueta={BTN_LISTO_APARIENCIA}
        pista={PISTA_LISTO_APARIENCIA}
        alPresionar={() => setAbierta(false)}
      />
    </Tarjeta>
  );
}
