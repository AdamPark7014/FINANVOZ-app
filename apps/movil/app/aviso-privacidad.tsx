import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AVISO_COMPLETO } from '../src/pantallas/onboarding/aviso';
import { VERSION_CONSENTIMIENTO } from '../src/servicios';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Consejo en pantalla (`02 §14`): solo lectura; la aceptación ocurre en O2 o en reconsentimiento. */
const TIP_AVISO_PRIVACIDAD =
  'Es solo lectura aquí. Si cambiamos el aviso, te lo pediremos otra vez al abrir la app.';

/** Aviso de privacidad completo dentro de la app (`08 §2`), desde O2 y desde Ajustes. Solo lectura. */
export default function AvisoPrivacidad() {
  const router = useRouter();
  return (
    <Pantalla testID="aviso-privacidad" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="aviso-privacidad-volver"
        variante="texto"
        ancho="contenido"
        etiqueta="Volver"
        pista="Regresa a donde estabas"
        alPresionar={() => router.back()}
      />
      <Texto variante="titulo">Aviso de privacidad</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Versión ${VERSION_CONSENTIMIENTO}`}
      </Texto>
      <Texto testID="aviso-privacidad-tip" variante="secundario" tono="secundario">
        {TIP_AVISO_PRIVACIDAD}
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
