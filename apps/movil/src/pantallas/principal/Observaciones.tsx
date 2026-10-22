import { View } from 'react-native';
import { marcarObservacionVista, type FiltroMovimientos, type Observacion } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import {
  BTN_YA_LO_VI,
  contextoCifraObservacion,
  etiquetaObservacion,
  PISTA_VER_MOVIMIENTOS_OBSERVACION,
  PISTA_YA_LO_VI,
  textoObservacion,
  TITULO_OBSERVACIONES,
} from './observaciones-textos';
import { BTN_VER_MOVIMIENTOS } from './textos';

/**
 * "Lo que veo" (`02 §4.3`): hasta dos observaciones ya calculadas por `servicios/observaciones.ts`, cada una
 * con su cifra, "Ya lo vi" (la oculta en su periodo) y, cuando aplica, "Ver movimientos" con su filtro. Para
 * TalkBack cada observación es un solo elemento con la frase y las cifras en palabras; los botones, aparte.
 */
export function Observaciones({
  observaciones,
  alVerMovimientos,
}: {
  observaciones: readonly Observacion[];
  alVerMovimientos: (filtro: FiltroMovimientos) => void;
}) {
  const { ctx, refrescar } = useSesion();
  if (observaciones.length === 0) return null;
  return (
    <View style={{ gap: espacio.s }} testID="observaciones">
      <Texto variante="etiqueta" tono="secundario" accessibilityRole="header" testID="observaciones-titulo">
        {TITULO_OBSERVACIONES}
      </Texto>
      {observaciones.map((o, i) => {
        const testID = `observacion-${i}`;
        const filtro = o.filtro;
        return (
          <Tarjeta key={o.clave} testID={testID}>
            <View
              accessible
              accessibilityLabel={etiquetaObservacion(o)}
              style={{ gap: espacio.xs }}
              testID={`${testID}-cuerpo`}
            >
              <Cifra
                centavos={o.cifra}
                tamano="grande"
                contexto={contextoCifraObservacion(o)}
                testID={`${testID}-cifra`}
              />
              <Texto variante="cuerpo" testID={`${testID}-texto`}>
                {textoObservacion(o)}
              </Texto>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {filtro ? (
                <Boton
                  etiqueta={BTN_VER_MOVIMIENTOS}
                  variante="secundario"
                  ancho="contenido"
                  pista={PISTA_VER_MOVIMIENTOS_OBSERVACION}
                  alPresionar={() => alVerMovimientos(filtro)}
                  testID={`${testID}-ver-movimientos`}
                />
              ) : null}
              <Boton
                etiqueta={BTN_YA_LO_VI}
                variante="texto"
                ancho="contenido"
                pista={PISTA_YA_LO_VI}
                alPresionar={() => {
                  marcarObservacionVista(ctx, o.clave);
                  refrescar();
                }}
                testID={`${testID}-ya-lo-vi`}
              />
            </View>
          </Tarjeta>
        );
      })}
    </View>
  );
}
