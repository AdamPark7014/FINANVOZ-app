import { View } from 'react-native';
import type { ConsultaMeAlcanza, FiltroMovimientos } from '../../servicios';
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
  alVerMovimientos,
  alVerMovimiento,
  alArqueo,
  alMeAlcanza,
  fraseRevision,
  motor,
}: {
  alCerrar: () => void;
  /** "Ver movimientos" de una consulta: abre Movimientos con su filtro. */
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  /** Tocar el aviso "Registré…" abre el detalle del movimiento. */
  alVerMovimiento?: (transaccionId: string) => void;
  /** "Traigo 300": abre el arqueo. */
  alArqueo?: (efectivoReal: number) => void;
  /** "¿Me alcanza para…?": abre "¿Me alcanza?". */
  alMeAlcanza?: (consulta: ConsultaMeAlcanza) => void;
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
        abiertoAlInicio
        {...(alVerMovimientos ? { alVerMovimientos } : {})}
        {...(alVerMovimiento ? { alVerMovimiento } : {})}
        {...(alArqueo ? { alArqueo } : {})}
        {...(alMeAlcanza ? { alMeAlcanza } : {})}
        {...(fraseRevision ? { fraseRevision } : {})}
        {...(motor ? { motor } : {})}
      />
      <Texto variante="subtitulo">O llena los datos</Texto>
      <FormularioMovimiento
        alGuardar={alCerrar}
        {...(alVerMovimiento ? { alVerMovimiento } : {})}
      />
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}
