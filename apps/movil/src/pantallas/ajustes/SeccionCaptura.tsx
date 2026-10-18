import { useState } from 'react';
import { useCaptura } from '../../captura/ProveedorCaptura';
import { desactivarCaptura, fijarModoAvisoCaptura, obtenerEstadoCaptura } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Tarjeta, Texto } from '../../ui';
import { ActivarCaptura } from '../captura/ActivarCaptura';
import { GrupoChips } from '../principal/Chip';
import {
  BTN_ACTIVAR_CAPTURA,
  BTN_DESACTIVAR_CAPTURA,
  DESC_AVISO_AL_CAPTURAR,
  ETIQUETA_AVISO_AL_CAPTURAR,
  ETIQUETA_CAPTURA_APAGADA,
  ETIQUETA_CAPTURA_NO_DISPONIBLE,
  ESTADO_APAGADA,
  ESTADO_NO_DISPONIBLE,
  etiquetaCapturaActiva,
  OPCIONES_MODO_AVISO,
  PISTA_ACTIVAR_CAPTURA,
  PISTA_DESACTIVAR_CAPTURA,
  PREGUNTA_MODO_AVISO,
  SECCION_CAPTURA,
  textoCapturaActiva,
} from './captura-textos';

/**
 * Ajustes → Captura automática (`08 §3.1`: "Puedes desactivarlo cuando quieras en Ajustes"). Desactivar vacía
 * la lista blanca nativa: desde ese momento toda notificación se descarta sin guardarse (regla 10).
 */
export function SeccionCaptura() {
  const { ctx, refrescar } = useSesion();
  const { puente } = useCaptura();
  const estado = useVista(obtenerEstadoCaptura);
  const [activando, setActivando] = useState(false);
  return (
    <Tarjeta testID="ajustes-captura">
      <Texto variante="subtitulo" testID="ajustes-captura-titulo" accessibilityRole="header">
        {SECCION_CAPTURA}
      </Texto>
      {activando ? (
        <ActivarCaptura testID="ajustes-captura" alTerminar={() => setActivando(false)} />
      ) : estado.activada ? (
        <>
          <Texto
            variante="cuerpo"
            testID="ajustes-captura-estado"
            accessibilityLabel={etiquetaCapturaActiva(estado.apps.length)}
          >
            {textoCapturaActiva(estado.apps.length)}
          </Texto>
          <Texto variante="etiqueta">{ETIQUETA_AVISO_AL_CAPTURAR}</Texto>
          <Texto variante="secundario" tono="secundario">
            {DESC_AVISO_AL_CAPTURAR}
          </Texto>
          <GrupoChips
            prefijoTestID="ajustes-captura-aviso"
            etiqueta={PREGUNTA_MODO_AVISO}
            opciones={OPCIONES_MODO_AVISO}
            valor={estado.modoAviso}
            alCambiar={(modo) => {
              fijarModoAvisoCaptura(ctx, modo);
              refrescar();
            }}
          />
          <Boton
            etiqueta={BTN_DESACTIVAR_CAPTURA}
            variante="secundario"
            alPresionar={() => {
              desactivarCaptura(ctx);
              void puente?.fijarListaBlanca([]);
              refrescar();
            }}
            testID="ajustes-captura-desactivar"
            pista={PISTA_DESACTIVAR_CAPTURA}
            style={{ marginTop: espacio.s }}
          />
        </>
      ) : (
        <>
          <Texto variante="cuerpo" tono="secundario" testID="ajustes-captura-estado">
            {puente ? ESTADO_APAGADA : ESTADO_NO_DISPONIBLE}
          </Texto>
          {puente ? (
            <Boton
              etiqueta={BTN_ACTIVAR_CAPTURA}
              variante="secundario"
              alPresionar={() => setActivando(true)}
              testID="ajustes-captura-activar"
              pista={PISTA_ACTIVAR_CAPTURA}
            />
          ) : null}
        </>
      )}
    </Tarjeta>
  );
}
