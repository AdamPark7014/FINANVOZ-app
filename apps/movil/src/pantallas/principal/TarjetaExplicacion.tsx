import { View } from 'react-native';
import {
  AVISO_SIN_EXPLICACION,
  obtenerPlan,
  PIE_EXPLICAR,
  type FiltroMovimientos,
  type LineaConsulta,
  type RespuestaExplicar,
} from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, espacio, Tarjeta, Texto } from '../../ui';
import {
  BTN_LISTO,
  BTN_VER_MOVIMIENTOS_CHEVRON,
  BTN_VER_PLUS,
  MENSAJE_EXPLICAR_SOLO_PLUS,
} from './textos';

export type ExplicacionMostrable = Extract<
  RespuestaExplicar,
  { tipo: 'explicacion' | 'plantilla' | 'solo_plus' | 'limite' }
>;

function Lineas({ lineas }: { lineas: readonly LineaConsulta[] }) {
  if (lineas.length === 0) return null;
  return (
    <View style={{ gap: espacio.xs }}>
      {lineas.map((l, i) => (
        <View
          key={`${i}-${l.etiqueta}`}
          accessible
          accessibilityLabel={`${l.etiqueta}: ${l.valor}`}
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
        >
          <Texto variante="secundario" tono="secundario" style={{ flexShrink: 1 }}>
            {l.etiqueta}
          </Texto>
          <Texto variante="secundario">{l.valor}</Texto>
        </View>
      ))}
    </View>
  );
}

/**
 * Respuesta del modo explicar (`02 §22`, RF-CON-02): la explicación corta con sus cifras ya verificadas contra los
 * resultados de las herramientas, o, si la verificación falló, "No pude explicarlo mejor" con las respuestas en
 * plantilla. "Ver movimientos ›" abre Movimientos con el filtro de lo consultado. Pie fijo: no es asesoría.
 */
export function TarjetaExplicacion({
  respuesta,
  alVerMovimientos,
  alCerrar,
}: {
  respuesta: ExplicacionMostrable;
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  alCerrar: () => void;
}) {
  const { abrirPlan } = usePlanTienda();
  const plan = useVista(obtenerPlan).plan;
  const filtro =
    respuesta.tipo === 'solo_plus' || respuesta.tipo === 'limite' ? null : respuesta.filtro;
  const mostrarVerPlus =
    abrirPlan &&
    (respuesta.tipo === 'solo_plus' ||
      (respuesta.tipo === 'limite' && respuesta.codigo === 'limite_mensual' && plan === 'gratis'));
  const mostrarPie = respuesta.tipo !== 'solo_plus' && respuesta.tipo !== 'limite';
  return (
    <Tarjeta testID="respuesta-explicar">
      {respuesta.tipo === 'explicacion' ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="explicacion-texto">
          {respuesta.texto}
        </Texto>
      ) : null}
      {respuesta.tipo === 'plantilla' ? (
        <View style={{ gap: espacio.s }} testID="explicacion-plantilla">
          <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite">
            {AVISO_SIN_EXPLICACION}
          </Texto>
          {respuesta.respuestas.map((r, i) => (
            <View key={`${i}-${r.plantilla}`} style={{ gap: espacio.xs }}>
              <Texto variante="cuerpo">{r.texto}</Texto>
              <Lineas lineas={r.lineas} />
            </View>
          ))}
        </View>
      ) : null}
      {respuesta.tipo === 'solo_plus' ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="explicacion-solo-plus">
          {MENSAJE_EXPLICAR_SOLO_PLUS}
        </Texto>
      ) : null}
      {respuesta.tipo === 'limite' ? (
        <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="explicacion-limite">
          {respuesta.mensaje}
        </Texto>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {mostrarVerPlus ? (
          <Boton
            etiqueta={BTN_VER_PLUS}
            variante="secundario"
            ancho="contenido"
            alPresionar={abrirPlan}
            testID="boton-ver-plus-explicar"
          />
        ) : null}
        {filtro && Object.keys(filtro).length > 0 && alVerMovimientos ? (
          <Boton
            etiqueta={BTN_VER_MOVIMIENTOS_CHEVRON}
            variante="secundario"
            ancho="contenido"
            alPresionar={() => alVerMovimientos(filtro)}
            testID="boton-ver-movimientos-explicar"
          />
        ) : null}
        <Boton etiqueta={BTN_LISTO} variante="texto" ancho="contenido" alPresionar={alCerrar} />
      </View>
      {mostrarPie ? (
        <Texto variante="secundario" tono="secundario" testID="explicacion-pie">
          {PIE_EXPLICAR}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
