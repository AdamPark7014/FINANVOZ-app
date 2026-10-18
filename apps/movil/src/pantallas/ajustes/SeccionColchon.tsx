import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { colchonSugerido, fijarColchon, obtenerAjustes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, Tarjeta, Texto } from '../../ui';
import { ERROR_GUARDAR } from '../onboarding/componentes';
import {
  ayudaColchon,
  AYUDA_SIN_SUGERENCIA,
  BTN_APARTAR_COLCHON,
  BTN_CAMBIAR_COLCHON,
  BTN_CANCELAR,
  BTN_GUARDAR,
  confirmacionColchon,
  CONFIRMACION_SIN_COLCHON,
  ETIQUETA_MONTO_COLCHON,
  resumenConColchon,
  RESUMEN_SIN_COLCHON,
  SECCION_COLCHON,
} from './colchon-textos';

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
      setMensaje({ texto: ERROR_GUARDAR, error: true });
      return;
    }
    refrescar();
    setEditando(false);
    setMensaje({
      texto: monto > 0 ? confirmacionColchon(monto) : CONFIRMACION_SIN_COLCHON,
      error: false,
    });
  };

  return (
    <Tarjeta testID="ajustes-colchon">
      <Texto variante="subtitulo">{SECCION_COLCHON}</Texto>
      {editando ? (
        <>
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
        </>
      ) : (
        <>
          <Texto variante="secundario" tono="secundario" testID="ajustes-colchon-resumen">
            {colchon > 0 ? resumenConColchon(colchon) : RESUMEN_SIN_COLCHON}
          </Texto>
          <Boton
            testID="ajustes-cambiar-colchon"
            variante="secundario"
            etiqueta={colchon > 0 ? BTN_CAMBIAR_COLCHON : BTN_APARTAR_COLCHON}
            alPresionar={abrir}
          />
        </>
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje.error ? 'faltante' : 'acento'}
          accessibilityLiveRegion="polite"
          testID="ajustes-colchon-mensaje"
        >
          {mensaje.texto}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
