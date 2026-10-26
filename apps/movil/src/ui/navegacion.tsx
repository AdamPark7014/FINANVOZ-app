import { Stack, useNavigation, useRouter, type Href } from 'expo-router';
import { Pressable } from 'react-native';
import { Texto } from './componentes/Texto';
import { useTema } from './tema';
import { espacio, OBJETIVO_TACTIL_MIN, type Colores } from './tokens';

/** Lo que dice el lector de pantalla en el botón de atrás (nativo o el de salida sin historial). */
export const ETIQUETA_ATRAS = 'Atrás';
export const PISTA_SALIDA_SIN_HISTORIAL = 'Sale de esta pantalla';

/**
 * Opciones de la barra nativa del Stack (`PLAN-UX-VOZ` ola 3 §3): chevron nativo sin texto en iOS (flecha en
 * Android), sin «Volver» dentro del contenido. El título grande lo pone la pantalla en su contenido (un solo
 * encabezado para VoiceOver), así que la barra no repite el título ni usa el título grande de iOS, que se encimaba
 * con el contenido porque `Pantalla` no es un `ScrollView` de primer nivel. Los colores siguen el tema claro u
 * oscuro; sin ellos la barra salía con el tema por omisión de React Navigation.
 */
export function opcionesBarraNativa(c: Colores) {
  return {
    headerShown: true,
    // Sin título en la barra (ni en iOS ni en Android): el encabezado vive en el contenido.
    title: '',
    headerTitle: () => null,
    headerLargeTitle: false,
    headerTransparent: false,
    headerShadowVisible: false,
    // `minimal`: solo el chevron. El texto de atrás solo lo oye VoiceOver; sin él decía «(tabs)».
    headerBackButtonDisplayMode: 'minimal',
    headerBackTitle: ETIQUETA_ATRAS,
    headerTintColor: c.acentoTexto,
    headerStyle: { backgroundColor: c.fondo },
    contentStyle: { backgroundColor: c.fondo },
  } as const;
}

/** Botón de salida cuando la pantalla se abrió sin historial (un aviso, un enlace): reemplaza el chevron nativo. */
function BotonSalida({ alPresionar, c }: { alPresionar: () => void; c: Colores }) {
  return (
    <Pressable
      testID="barra-salida"
      accessibilityRole="button"
      accessibilityLabel={ETIQUETA_ATRAS}
      accessibilityHint={PISTA_SALIDA_SIN_HISTORIAL}
      onPress={alPresionar}
      hitSlop={espacio.s}
      style={{
        minWidth: OBJETIVO_TACTIL_MIN,
        minHeight: OBJETIVO_TACTIL_MIN,
        justifyContent: 'center',
      }}
    >
      <Texto
        variante="titulo"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: c.acentoTexto }}
      >
        ‹
      </Texto>
    </Pressable>
  );
}

/**
 * Barra nativa de una ruta del Stack. Con historial, el chevron nativo regresa (y el gesto de orilla en iPhone);
 * sin historial (se abrió en frío desde un aviso o un enlace, `PLAN-UX-VOZ` 1.10) muestra un botón que va a
 * `salida`. `Pantalla` ve la barra (`HeaderShownContext`) y ya no suma el área segura de arriba.
 */
export function BarraNativa({ salida }: { salida: Href }) {
  const { c } = useTema();
  const router = useRouter();
  const navigation = useNavigation();
  const opciones = opcionesBarraNativa(c);
  const conHistorial = navigation.canGoBack();
  return (
    <Stack.Screen
      options={
        conHistorial
          ? opciones
          : {
              ...opciones,
              headerLeft: () => <BotonSalida c={c} alPresionar={() => router.replace(salida)} />,
            }
      }
    />
  );
}
