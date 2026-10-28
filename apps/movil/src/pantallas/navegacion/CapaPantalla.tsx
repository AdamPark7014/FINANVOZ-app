import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type PonerCapa = (nodo: ReactNode) => void;

const ContextoCapa = createContext<PonerCapa | null>(null);

/**
 * Lugar para una capa que tapa toda la pantalla, también la navegación de arriba (dirección B+, «Te escucho» en D2).
 * Va en el layout de las pestañas; la pantalla que la necesita la pone con `CapaPantallaCompleta`. El toque que ya
 * empezó abajo (mantener el micrófono del dock) sigue siendo de quien lo recibió: la capa no lo corta.
 */
export function AnfitrionCapa({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<ReactNode>(null);
  return (
    <ContextoCapa.Provider value={setNodo}>
      <View style={{ flex: 1 }}>
        {children}
        {nodo ? <View style={StyleSheet.absoluteFill}>{nodo}</View> : null}
      </View>
    </ContextoCapa.Provider>
  );
}

/**
 * Pinta `children` en la capa de arriba de todo si hay `AnfitrionCapa`; si no (una pantalla suelta, las pruebas), la
 * pinta encima de su propio contenedor.
 */
export function CapaPantallaCompleta({ children }: { children: ReactNode }) {
  const poner = useContext(ContextoCapa);
  useLayoutEffect(() => {
    poner?.(children);
  }, [poner, children]);
  useEffect(() => () => poner?.(null), [poner]);
  if (poner) return null;
  return <View style={StyleSheet.absoluteFill}>{children}</View>;
}
