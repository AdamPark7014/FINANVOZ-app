import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AVISO_COMPLETO } from '../src/pantallas/onboarding/aviso';
import {
  ETIQUETA_VOLVER,
  lineaVersionAviso,
  PISTA_VOLVER,
  TIP_AVISO_PRIVACIDAD,
  TITULO_AVISO_PRIVACIDAD,
} from '../src/pantallas/privacidad';
import { VERSION_CONSENTIMIENTO } from '../src/servicios';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Aviso de privacidad completo dentro de la app (`08 §2`), desde O2 y desde Ajustes. Solo lectura. */
export default function AvisoPrivacidad() {
  const router = useRouter();
  // Sin pantalla anterior (enlace directo) se vuelve al inicio, que decide entre onboarding y Hoy: el aviso también
  // se abre desde O2, antes de terminar el onboarding.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Pantalla
      testID="aviso-privacidad"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      <Boton
        testID="aviso-privacidad-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={volver}
      />
      <Texto variante="titulo">{TITULO_AVISO_PRIVACIDAD}</Texto>
      <Texto variante="secundario" tono="secundario">
        {lineaVersionAviso(VERSION_CONSENTIMIENTO)}
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
