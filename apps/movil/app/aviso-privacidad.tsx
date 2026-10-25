import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AVISO_COMPLETO } from '../src/pantallas/onboarding/aviso';
import {
  lineaVersionAviso,
  TIP_AVISO_PRIVACIDAD,
  TITULO_AVISO_PRIVACIDAD,
} from '../src/pantallas/privacidad';
import { VERSION_CONSENTIMIENTO } from '../src/servicios';
import { espacio, Pantalla, Texto } from '../src/ui';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Aviso de privacidad completo dentro de la app (`08 §2`), desde O2 y desde Ajustes. Solo lectura. */
export default function AvisoPrivacidad() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_AVISO_PRIVACIDAD)} />
      <Pantalla
        testID="aviso-privacidad"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
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
    </>
  );
}
