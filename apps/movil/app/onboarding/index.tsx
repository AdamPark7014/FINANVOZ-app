import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import {
  AYUDA_BIENVENIDA,
  BTN_ONB_CONTINUAR,
  BTN_ONB_EMPEZAR,
  cuerpoBienvenida,
  EJEMPLO_FRASE_BIENVENIDA,
  EJEMPLO_RESPUESTA_BIENVENIDA,
  etiquetaEjemploBienvenida,
  PISTA_ONB_CONTINUAR,
  PISTA_ONB_EMPEZAR,
  TITULO_BIENVENIDA,
} from '../../src/pantallas/onboarding/textos';
import { BTN_ONBOARDING_RESTAURAR, PISTA_ONBOARDING_RESTAURAR } from '../../src/pantallas/respaldo';
import { obtenerConsentimiento } from '../../src/servicios';
import { useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, espacio, FUENTE, Icono, Orbe, radio, Texto, useTema } from '../../src/ui';

/**
 * O1 · Bienvenida: la promesa en una frase, con la cara del asistente (el orbe) y una muestra de cómo se usa. Si ya
 * aceptó el aviso (volvió a abrir a medias), sigue en O3. Quien viene de otro teléfono puede restaurar su respaldo
 * (M9).
 */
export default function Bienvenida() {
  const router = useRouter();
  const yaAcepto = useVista((ctx) => obtenerConsentimiento(ctx) !== null);
  return (
    <PasoOnboarding
      testID="onb-bienvenida"
      paso={1}
      titulo={TITULO_BIENVENIDA}
      ayuda={AYUDA_BIENVENIDA}
      encabezado={
        <View style={{ paddingTop: espacio.l, paddingLeft: espacio.s }}>
          <Orbe tamano={84} testID="onb-orbe" />
        </View>
      }
      pie={
        <>
          <Boton
            testID="onb-empezar"
            etiqueta={yaAcepto ? BTN_ONB_CONTINUAR : BTN_ONB_EMPEZAR}
            pista={yaAcepto ? PISTA_ONB_CONTINUAR : PISTA_ONB_EMPEZAR}
            alPresionar={() => router.push(yaAcepto ? '/onboarding/ingreso' : '/onboarding/consentimiento')}
          />
          {/* Teléfono nuevo (`02 §19`): restaurar un respaldo en lugar de empezar de cero. */}
          <Boton
            testID="onb-restaurar"
            variante="texto"
            etiqueta={BTN_ONBOARDING_RESTAURAR}
            pista={PISTA_ONBOARDING_RESTAURAR}
            alPresionar={() => router.push('/restaurar')}
          />
        </>
      }
    >
      <CuerpoBienvenida />
    </PasoOnboarding>
  );
}

/** La muestra: lo que dices (tu burbuja) y lo que contesta el asistente, como en la plática; debajo, la promesa. */
function CuerpoBienvenida() {
  const { c } = useTema();
  return (
    <View style={{ gap: espacio.l }}>
      <View
        testID="onb-ejemplo"
        accessible
        accessibilityRole="text"
        accessibilityLabel={etiquetaEjemploBienvenida()}
        style={{
          padding: espacio.l,
          borderRadius: radio.xl,
          backgroundColor: c.superficie,
          borderWidth: 1,
          borderColor: c.borde,
          gap: espacio.m,
        }}
      >
        <View
          style={{
            alignSelf: 'flex-end',
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.xs + 2,
            paddingHorizontal: espacio.m + 2,
            paddingVertical: espacio.s,
            borderRadius: radio.l,
            backgroundColor: c.acento,
          }}
        >
          <Icono nombre="microfono" color={c.sobreAcento} tamano={14} grosor={2} />
          <Text
            accessible={false}
            style={{
              fontFamily: FUENTE,
              fontSize: 16,
              lineHeight: 22,
              fontWeight: '500',
              color: c.sobreAcento,
            }}
          >
            {EJEMPLO_FRASE_BIENVENIDA}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Orbe tamano={24} estado="quieto" testID="onb-ejemplo-orbe" />
          <Text
            accessible={false}
            style={{ fontFamily: FUENTE, fontSize: 18, lineHeight: 26, fontWeight: '500', color: c.texto }}
          >
            {EJEMPLO_RESPUESTA_BIENVENIDA}
          </Text>
        </View>
      </View>
      <Texto variante="secundario" tono="secundario">
        {cuerpoBienvenida()}
      </Texto>
    </View>
  );
}
