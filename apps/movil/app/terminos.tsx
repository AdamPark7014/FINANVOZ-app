import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { TERMINOS, VERSION_TERMINOS } from '../src/pantallas/privacidad/legales';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Términos de uso (`08 §1`, checklist §7.1), desde el centro de privacidad y Ajustes. Solo lectura. */
export default function Terminos() {
  const router = useRouter();
  return (
    <Pantalla testID="terminos" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton variante="texto" ancho="contenido" etiqueta="Volver" alPresionar={() => router.back()} />
      <Texto variante="titulo">Términos de uso</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Versión ${VERSION_TERMINOS}`}
      </Texto>
      {TERMINOS.map((s) => (
        <View key={s.titulo} style={{ gap: espacio.s }}>
          <Texto variante="subtitulo">{s.titulo}</Texto>
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
