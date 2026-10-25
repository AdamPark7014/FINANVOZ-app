import { Stack } from 'expo-router';
import { View } from 'react-native';
import {
  etiquetaAccesibilidadVersionTerminos,
  lineaVersionTerminos,
  TERMINOS_CORTO,
  TITULO_TERMINOS,
  VERSION_TERMINOS,
} from '../src/pantallas/privacidad';
import { espacio, Pantalla, Texto } from '../src/ui';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Términos de uso (`08 §1`, checklist §7.1), desde el centro de privacidad y Ajustes. Solo lectura. */
export default function Terminos() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_TERMINOS)} />
      <Pantalla
        testID="terminos"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <Texto
          testID="terminos-version"
          variante="secundario"
          tono="secundario"
          accessibilityLabel={etiquetaAccesibilidadVersionTerminos(VERSION_TERMINOS)}
        >
          {lineaVersionTerminos(VERSION_TERMINOS)}
        </Texto>
        {TERMINOS_CORTO.map((s) => (
          <View key={s.titulo} testID={`terminos-seccion-${s.titulo}`} style={{ gap: espacio.s }}>
            <Texto variante="subtitulo" accessibilityRole="header">
              {s.titulo}
            </Texto>
            {s.parrafos.map((p) => (
              <Texto key={p} variante="cuerpo">
                {p}
              </Texto>
            ))}
          </View>
        ))}
      </Pantalla>
    </>
  );
}
