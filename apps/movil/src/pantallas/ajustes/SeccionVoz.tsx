import { useState } from 'react';
import { View } from 'react-native';
import { fijarVozRespuesta, obtenerVozRespuesta } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { MENSAJE_NO_GUARDAR } from './textos';
import {
  DESC_CONTESTAR_EN_VOZ,
  ETIQUETA_CONTESTAR_EN_VOZ,
  PISTA_CONTESTAR_EN_VOZ,
  SECCION_VOZ,
} from './voz-textos';

/** Ajustes → Voz: "Contestarte en voz" tras dictar (encendido salvo con bloqueo biométrico). */
export function SeccionVoz() {
  const { ctx, refrescar } = useSesion();
  const { activa } = useVista(obtenerVozRespuesta);
  const [error, setError] = useState(false);

  return (
    <Tarjeta testID="ajustes-voz">
      <Texto variante="subtitulo" testID="ajustes-voz-titulo" accessibilityRole="header">
        {SECCION_VOZ}
      </Texto>
      <View style={{ marginTop: espacio.s }}>
        <Interruptor
          testID="ajustes-voz-contestar"
          etiqueta={ETIQUETA_CONTESTAR_EN_VOZ}
          descripcion={DESC_CONTESTAR_EN_VOZ}
          pista={PISTA_CONTESTAR_EN_VOZ}
          valor={activa}
          alCambiar={(valor) => {
            try {
              fijarVozRespuesta(ctx, valor);
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
          testID="ajustes-voz-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {MENSAJE_NO_GUARDAR}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
