import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { colchonSugerido, fijarColchon, obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { View } from 'react-native';
import { Boton, CampoMonto, espacio, etiquetaFilaAjuste, FilaAjuste, Tarjeta, Texto } from '../../ui';
import {
  ayudaColchon,
  AYUDA_SIN_SUGERENCIA,
  BTN_APARTAR_COLCHON,
  BTN_CAMBIAR_COLCHON,
  BTN_CANCELAR,
  BTN_GUARDAR,
  PISTA_APARTAR_COLCHON,
  PISTA_CAMBIAR_COLCHON,
  PISTA_GUARDAR_COLCHON,
  confirmacionColchon,
  CONFIRMACION_SIN_COLCHON,
  ETIQUETA_MONTO_COLCHON,
  resumenConColchon,
  RESUMEN_SIN_COLCHON,
  SECCION_COLCHON,
} from './colchon-textos';
import { MENSAJE_NO_GUARDAR } from './textos';

/**
 * Ajustes › Colchón (`02 §12`, RF-CFG-02): lo que no cuenta para lo que puedes gastar. Se guarda con el mismo
 * servicio que O7. Para quitarlo hay que escribir 0: un campo vacío no borra el colchón por accidente.
 */
export function SeccionColchon() {
  const { ctx, refrescar } = useSesion();
  const { colchon } = useVista(obtenerAjustes);
  const sugerido = useVista(colchonSugerido);
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const inicial = colchon > 0 ? colchon : sugerido > 0 ? sugerido : null;

  const abrir = () => {
    setMonto(inicial);
    setMensaje(null);
    setEditando(true);
  };

  const guardar = () => {
    if (monto === null) return;
    try {
      fijarColchon(ctx, monto);
    } catch {
      setMensaje({ texto: MENSAJE_NO_GUARDAR, error: true });
      return;
    }
    refrescar();
    setEditando(false);
    setMensaje({
      texto: monto > 0 ? confirmacionColchon(monto) : CONFIRMACION_SIN_COLCHON,
      error: false,
    });
  };

  const resumen = colchon > 0 ? resumenConColchon(colchon) : RESUMEN_SIN_COLCHON;
  const accion = colchon > 0 ? BTN_CAMBIAR_COLCHON : BTN_APARTAR_COLCHON;
  const textoMensaje = mensaje ? (
    <Texto
      variante="secundario"
      tono={mensaje.error ? 'faltante' : 'acento'}
      accessibilityLiveRegion="polite"
      testID="ajustes-colchon-mensaje"
    >
      {mensaje.texto}
    </Texto>
  ) : null;

  // Cerrado es una fila de Ajustes (`PLAN-UX-VOZ` §3.6): tocarla abre el campo aquí mismo.
  if (!editando) {
    return (
      <View testID="ajustes-colchon" style={{ gap: espacio.s }}>
        <FilaAjuste
          testID="ajustes-cambiar-colchon"
          testIDTitulo="ajustes-colchon-titulo"
          testIDValor="ajustes-colchon-resumen"
          tituloEsEncabezado
          titulo={SECCION_COLCHON}
          valor={resumen}
          pista={colchon > 0 ? PISTA_CAMBIAR_COLCHON : PISTA_APARTAR_COLCHON}
          etiquetaAccesible={etiquetaFilaAjuste(SECCION_COLCHON, resumen, accion)}
          alPresionar={abrir}
        />
        {textoMensaje}
      </View>
    );
  }

  return (
    <Tarjeta testID="ajustes-colchon">
      <Texto variante="subtitulo" testID="ajustes-colchon-titulo" accessibilityRole="header">
        {SECCION_COLCHON}
      </Texto>
      <CampoMonto
        testID="ajustes-colchon-monto"
        etiqueta={ETIQUETA_MONTO_COLCHON}
        valorInicial={inicial}
        ayuda={sugerido > 0 ? ayudaColchon(sugerido) : AYUDA_SIN_SUGERENCIA}
        alCambiar={setMonto}
      />
      <Boton
        testID="ajustes-colchon-guardar"
        etiqueta={BTN_GUARDAR}
        pista={PISTA_GUARDAR_COLCHON}
        deshabilitado={monto === null}
        alPresionar={guardar}
      />
      <Boton
        testID="ajustes-colchon-cancelar"
        variante="texto"
        ancho="contenido"
        etiqueta={BTN_CANCELAR}
        alPresionar={() => setEditando(false)}
      />
      {textoMensaje}
    </Tarjeta>
  );
}
