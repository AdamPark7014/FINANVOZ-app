import { PantallaAyuda } from '../src/pantallas/ayuda';
import { espacio, Pantalla } from '../src/ui';
import { BarraNativa } from '../src/ui/navegacion';

/** Ayuda (CA-M13-04): preguntas frecuentes y correo de contacto, desde Ajustes. */
export default function Ayuda() {
  return (
    <>
      <BarraNativa salida="/hoy" />
      <Pantalla
        testID="ayuda"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <PantallaAyuda />
      </Pantalla>
    </>
  );
}
