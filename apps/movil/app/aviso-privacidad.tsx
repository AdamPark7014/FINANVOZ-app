import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AVISO_COMPLETO } from '../src/pantallas/onboarding/aviso';
import { VERSION_CONSENTIMIENTO } from '../src/servicios';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Aviso de privacidad completo dentro de la app (`08 §2`), desde O2 y desde Ajustes. Solo lectura. */
export default function AvisoPrivacidad() {
  const router = useRouter();
  return (
    <Pantalla testID="aviso-privacidad" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton variante="texto" ancho="contenido" etiqueta="Volver" alPresionar={() => router.back()} />
      <Texto variante="titulo">Aviso de privacidad</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Versión ${VERSION_CONSENTIMIENTO}`}
      </Texto>
      {AVISO_COMPLETO.map((s) => (
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
