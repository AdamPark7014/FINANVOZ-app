import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { Aviso, barraPestanas, useAviso, type DatosAviso } from '../../ui';

type Mostrar = (datos: Omit<DatosAviso, 'id'>) => void;

const AvisosContexto = createContext<Mostrar | null>(null);

/**
 * Un solo aviso inferior para las pestañas: sobrevive al cambiar de pantalla (registrar desde el formulario y
 * volver a Hoy sin perder "Deshacer"). `sobrePestanas` lo sube por encima de la barra.
 */
export function ProveedorAvisos({
  children,
  sobrePestanas = false,
}: {
  children: ReactNode;
  sobrePestanas?: boolean;
}) {
  const { aviso, mostrar, cerrar } = useAviso();
  return (
    <AvisosContexto.Provider value={mostrar}>
      <View style={{ flex: 1 }}>
        {children}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: sobrePestanas ? barraPestanas.alto : 0,
            height: 0,
            overflow: 'visible',
          }}
        >
          <Aviso aviso={aviso} alCerrar={cerrar} />
        </View>
      </View>
    </AvisosContexto.Provider>
  );
}

export function useMostrarAviso(): Mostrar {
  const mostrar = useContext(AvisosContexto);
  if (!mostrar) throw new Error('useMostrarAviso fuera de ProveedorAvisos');
  return mostrar;
}
