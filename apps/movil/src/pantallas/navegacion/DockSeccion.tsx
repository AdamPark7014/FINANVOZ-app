import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { dockVoz, useTema } from '../../ui';
import { useReservarEspacioAviso } from '../../ui/componentes/Aviso';
import type { BotonHablar } from '../../voz';
import { MicrofonoAsistente } from '../asistente/MicrofonoAsistente';
import { pedirAlAsistente, type PedidoAsistente } from '../asistente/r2';
import { ETIQUETA_TECLADO, PISTA_DOCK_ESCRIBIR_FUERA, PISTA_DOCK_HABLAR_FUERA } from '../asistente/textos';
import { DockVoz, useMedidasDock, type BotonDock } from './DockVoz';

/**
 * El dock de voz de Movimientos y Cuentas (dirección B, `02 §2`): flota al pie sobre la lista. «Escribir» y el
 * micrófono llevan al asistente (que es quien contesta) con el campo abierto o escuchando; la acción de la derecha
 * es de la pantalla («Buscar», «Agregar»). El aviso inferior sube para no taparlo.
 */
export function DockSeccion({
  derecha,
  etiquetaHablar,
  prefijoTestID,
}: {
  derecha: BotonDock;
  /** Qué se puede decir aquí («Toca para preguntar o registrar»). */
  etiquetaHablar: string;
  /** `dock-movimientos` → `dock-movimientos-escribir`, `dock-movimientos-hablar`. */
  prefijoTestID: string;
}) {
  const router = useRouter();
  const { c } = useTema();
  const { abajo, ocupado } = useMedidasDock();
  useReservarEspacioAviso(ocupado);
  const irAlAsistente = (pedido: PedidoAsistente) => {
    pedirAlAsistente(pedido);
    router.navigate('/hoy');
  };
  const hablar = () => irAlAsistente({ tipo: 'dictar' });
  // El micrófono de aquí no escucha: lleva al asistente escuchando (un toque, o la acción «activar» del lector).
  const boton: BotonHablar = {
    alPresionarDentro: () => {},
    alSoltar: hablar,
    accionesAccesibles: [{ name: 'activate' }],
    alAccionAccesible: (e) => {
      if (e.nativeEvent.actionName === 'activate') hablar();
    },
    alDeslizarFuera: () => {},
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: dockVoz.margenLateral,
        right: dockVoz.margenLateral,
        bottom: abajo,
      }}
    >
      <DockVoz
        testID={prefijoTestID}
        style={{
          // Lo de atrás se desvanece hacia el dock (B4: sombra del color del fondo).
          shadowColor: c.fondo,
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.9,
          shadowRadius: 24,
        }}
        izquierda={{
          etiqueta: ETIQUETA_TECLADO,
          icono: 'teclado',
          alPresionar: () => irAlAsistente({ tipo: 'escribir' }),
          testID: `${prefijoTestID}-escribir`,
          pista: PISTA_DOCK_ESCRIBIR_FUERA,
        }}
        centro={
          <MicrofonoAsistente
            escuchando={false}
            boton={boton}
            testID={`${prefijoTestID}-hablar`}
            etiqueta={etiquetaHablar}
            pista={PISTA_DOCK_HABLAR_FUERA}
          />
        }
        derecha={derecha}
      />
    </View>
  );
}
