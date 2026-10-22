import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  ETIQUETA_VOLVER,
  PISTA_VOLVER,
  etiquetaAccesibilidadVersionTerminos,
  lineaVersionTerminos,
  TERMINOS_CORTO,
  TITULO_TERMINOS,
  VERSION_TERMINOS,
} from '../src/pantallas/privacidad';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Términos de uso (`08 §1`, checklist §7.1), desde el centro de privacidad y Ajustes. Solo lectura. */
export default function Terminos() {
  const router = useRouter();
  // Abierta desde un aviso o un enlace no hay a dónde regresar: se va a Hoy.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <Pantalla testID="terminos" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="terminos-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={volver}
      />
      <Texto testID="terminos-titulo" variante="titulo" accessibilityRole="header">
        {TITULO_TERMINOS}
      </Texto>
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
  );
}
