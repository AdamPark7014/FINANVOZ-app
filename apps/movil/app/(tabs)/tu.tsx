import { View } from 'react-native';
import { PantallaAjustes } from '../ajustes';
import { propsContenedorPestana } from '../../src/rutas/pestanas-textos';

/**
 * Pestaña Tú (Ola 7 §2): Ajustes deja de vivir detrás de un engrane y se vuelve pestaña (ingreso, colchón, voz,
 * avisos, bloqueo, respaldo, privacidad, plan y ayuda). La ruta `/ajustes` sigue existiendo para los enlaces
 * internos (Cuentas, avisos, Ajustes › Ingreso); dentro de la pestaña no lleva «Volver».
 */
export default function Tu() {
  return (
    <View style={{ flex: 1 }} {...propsContenedorPestana('tu')}>
      <PantallaAjustes enPestana />
    </View>
  );
}
