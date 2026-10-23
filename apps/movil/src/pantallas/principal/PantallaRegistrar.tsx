import { View } from 'react-native';
import type { ConsultaMeAlcanza, FiltroMovimientos } from '../../servicios';
import { Boton, espacio, Pantalla, Texto } from '../../ui';
import type { MotorDictado } from '../../voz';
import { FormularioMovimiento } from './FormularioMovimiento';
import { PanelRegistrar } from './PanelRegistrar';

/** TalkBack al cerrar la pantalla (`02 §15`). */
const ACCESIBILIDAD_CERRAR_REGISTRAR = 'Cerrar registro';
const PISTA_CERRAR_REGISTRAR = 'Vuelve a la pantalla anterior; lo que no guardaste no se registra';

/**
 * Registrar de antes (dictado arriba y formulario completo abajo). Desde la Ola 7 ya no tiene ruta: la vía rápida es
 * el asistente y `/registrar` abre R2 (`pantallas/asistente/PantallaR2`). Queda como envoltura mínima para las
 * pruebas de otras pantallas que todavía la montan.
 */
export function PantallaRegistrar({
  alCerrar,
  alVerMovimientos,
  alVerMovimiento,
  alArqueo,
  alMeAlcanza,
  fraseRevision,
  motor,
  dictarAlAbrir = false,
}: {
  alCerrar: () => void;
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  alVerMovimiento?: (transaccionId: string) => void;
  alArqueo?: (efectivoReal: number) => void;
  alMeAlcanza?: (consulta: ConsultaMeAlcanza) => void;
  fraseRevision?: string;
  motor?: MotorDictado;
  dictarAlAbrir?: boolean;
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
        <Texto variante="titulo" testID="registrar-titulo" accessibilityRole="header">
          Registrar
        </Texto>
        <Boton
          etiqueta="Cerrar"
          variante="texto"
          ancho="contenido"
          alPresionar={alCerrar}
          etiquetaAccesible={ACCESIBILIDAD_CERRAR_REGISTRAR}
          pista={PISTA_CERRAR_REGISTRAR}
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
        dictarAlAbrir={dictarAlAbrir}
      />
      <Texto variante="subtitulo" testID="registrar-formulario-titulo" accessibilityRole="header">
        O llena los datos
      </Texto>
      <FormularioMovimiento alGuardar={alCerrar} {...(alVerMovimiento ? { alVerMovimiento } : {})} />
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}
