import { View } from 'react-native';
import { Boton, espacio, Pantalla, Texto } from '../../ui';
import type { MotorDictado } from '../../voz';
import { FormularioMovimiento } from './FormularioMovimiento';
import { PanelRegistrar } from './PanelRegistrar';

/**
 * Registrar (02-UX §5): dictado o texto arriba (la vía rápida) y el formulario completo abajo, para los tipos
 * que origina el usuario. Al guardar regresa a la pantalla anterior con el aviso "Deshacer".
 */
export function PantallaRegistrar({
  alCerrar,
  alConsultarHoy,
  alVerMovimientos,
  alVerCuentas,
  alArqueo,
  fraseRevision,
  motor,
}: {
  alCerrar: () => void;
  alConsultarHoy: () => void;
  alVerMovimientos?: () => void;
  alVerCuentas?: () => void;
  /** "Traigo 300": abre el arqueo. */
  alArqueo?: (efectivoReal: number) => void;
  /** Frase de "Por revisar" que se abre para confirmarla. */
  fraseRevision?: string;
  motor?: MotorDictado;
}) {
  return (
    <Pantalla testID="pantalla-registrar">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo">Registrar</Texto>
        <Boton
          etiqueta="Cerrar"
          variante="texto"
          ancho="contenido"
          alPresionar={alCerrar}
          testID="boton-cerrar-registrar"
        />
      </View>
      <PanelRegistrar
        alConsultarHoy={alConsultarHoy}
        abiertoAlInicio
        {...(alVerMovimientos ? { alVerMovimientos } : {})}
        {...(alVerCuentas ? { alVerCuentas } : {})}
        {...(alArqueo ? { alArqueo } : {})}
        {...(fraseRevision ? { fraseRevision } : {})}
        {...(motor ? { motor } : {})}
      />
      <Texto variante="subtitulo">O llena los datos</Texto>
      <FormularioMovimiento alGuardar={alCerrar} />
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}
