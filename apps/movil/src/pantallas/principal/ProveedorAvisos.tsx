import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { anunciar, Aviso, barraPestanas, etiquetaHablada, useAviso, type DatosAviso } from '../../ui';

type Mostrar = (datos: Omit<DatosAviso, 'id'>) => void;

const AvisosContexto = createContext<Mostrar | null>(null);
const AltoPestanasContexto = createContext<((alto: number) => void) | null>(null);

/** Alto de la barra de pestañas sin el área segura, como la calcula React Navigation (UIKit). */
const ALTO_BARRA_NATIVA = 49;

/**
 * VoiceOver no lee `accessibilityLiveRegion` (solo existe en Android): en iOS cada mensaje que en Android anuncia la
 * región viva se anuncia con `anunciar` de `ui/`, con las cifras en palabras (`02 §15`). En Android no hace nada
 * para no repetirlo.
 */
function anunciarMensaje(mensaje: string | null | undefined): void {
  if (mensaje) anunciar(etiquetaHablada(mensaje));
}

/** Anuncia en iOS el mensaje cada vez que aparece o cambia (errores, respuestas, confirmaciones). */
export function useAnuncio(mensaje: string | null | undefined): void {
  useEffect(() => {
    anunciarMensaje(mensaje);
  }, [mensaje]);
}

/**
 * Una pantalla dentro de las pestañas informa el alto real de la barra (`BottomTabBarHeightContext`): en iPhone con
 * indicador de inicio mide ~83, no los 64 del token. Fuera de las pestañas (`undefined`) no hace nada.
 */
export function useInformarAltoPestanas(alto: number | undefined): void {
  const informar = useContext(AltoPestanasContexto);
  useEffect(() => {
    if (informar && alto !== undefined && alto > 0) informar(alto);
  }, [informar, alto]);
}

/**
 * Un solo aviso inferior para las pestañas: sobrevive al cambiar de pantalla (registrar desde el formulario y
 * volver a Hoy sin perder "Deshacer"). `sobrePestanas` lo sube por encima de la barra; sin pestañas, por encima del
 * indicador de inicio del iPhone (área segura).
 */
export function ProveedorAvisos({
  children,
  sobrePestanas = false,
}: {
  children: ReactNode;
  sobrePestanas?: boolean;
}) {
  const { aviso, mostrar, cerrar } = useAviso();
  // Sin `SafeAreaProvider` (pruebas de una pantalla) el contexto es `null`: sin margen extra.
  const inferior = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const [altoMedido, setAltoMedido] = useState<number | null>(null);
  const informarAlto = useCallback((alto: number) => setAltoMedido(alto), []);
  // Mientras ninguna pestaña informa su alto, se estima igual que React Navigation (con el mínimo del token).
  const abajo = sobrePestanas
    ? (altoMedido ?? Math.max(barraPestanas.alto, ALTO_BARRA_NATIVA + inferior))
    : inferior;

  const idAviso = aviso?.id;
  const mensajeAviso = aviso?.mensaje;
  useEffect(() => {
    if (idAviso !== undefined) anunciarMensaje(mensajeAviso);
  }, [idAviso, mensajeAviso]);

  return (
    <AvisosContexto.Provider value={mostrar}>
      <AltoPestanasContexto.Provider value={informarAlto}>
        <View style={{ flex: 1 }}>
          {children}
          <View
            pointerEvents="box-none"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            importantForAccessibility="yes"
            testID="avisos-contenedor"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: abajo,
              height: 0,
              overflow: 'visible',
            }}
          >
            <Aviso aviso={aviso} alCerrar={cerrar} />
          </View>
        </View>
      </AltoPestanasContexto.Provider>
    </AvisosContexto.Provider>
  );
}

export function useMostrarAviso(): Mostrar {
  const mostrar = useContext(AvisosContexto);
  if (!mostrar) throw new Error('useMostrarAviso fuera de ProveedorAvisos');
  return mostrar;
}
