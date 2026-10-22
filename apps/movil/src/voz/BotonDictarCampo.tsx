import { useCallback, useEffect } from 'react';
import { Pressable } from 'react-native';
import { etiquetaHablada, OBJETIVO_TACTIL_MIN, radio, useTema } from '../ui';
import type { PropsBotonDictarCampo } from '../ui';
import { MENSAJES_DICTADO } from './estado';
import type { MotorDictado } from './motor';
import { motorExpo } from './motor-expo';
import { Microfono } from './Microfono';
import { callarVoz } from './respuesta';
import { TEXTO_TE_ESCUCHO } from './textos';
import { useBotonHablar } from './useBotonHablar';
import { useDictado } from './useDictado';

export const PISTA_DICTAR_CAMPO =
  'Toca y di la cantidad, por ejemplo mil quinientos. Toca otra vez para terminar.';

/**
 * Micrófono a la derecha de un campo de monto: toca, di la cantidad y el campo se llena (lo interpreta el nivel 0
 * en el teléfono). Sin reconocimiento en el teléfono no se muestra.
 */
export function BotonDictarCampo({
  etiquetaCampo,
  alOir,
  alAviso,
  testID,
  motor = motorExpo,
}: PropsBotonDictarCampo & { motor?: MotorDictado }) {
  const { c } = useTema();
  const dictado = useDictado({ motor, alTerminar: alOir });
  const escuchando = dictado.estado === 'escuchando' || dictado.estado === 'procesando';
  const iniciar = useCallback(() => {
    callarVoz();
    return dictado.iniciar();
  }, [dictado]);
  const boton = useBotonHablar({ escuchando, iniciar, detener: dictado.detener });
  const aviso =
    dictado.estado === 'sin_permiso'
      ? MENSAJES_DICTADO.sin_permiso
      : dictado.error && dictado.error !== 'no_disponible'
        ? MENSAJES_DICTADO[dictado.error]
        : escuchando
          ? dictado.parcial || TEXTO_TE_ESCUCHO
          : null;
  const sinPermiso = dictado.estado === 'sin_permiso';
  useEffect(() => {
    alAviso(aviso === null ? null : { texto: aviso, sinPermiso });
  }, [aviso, sinPermiso, alAviso]);
  if (!motor.disponible() || dictado.error === 'no_disponible') return null;
  return (
    <Pressable
      {...(testID === undefined ? {} : { testID })}
      onPressIn={boton.alPresionarDentro}
      onPressOut={boton.alSoltar}
      accessibilityActions={boton.accionesAccesibles}
      onAccessibilityAction={boton.alAccionAccesible}
      accessibilityRole="button"
      accessibilityLabel={
        escuchando ? 'Escuchando. Toca para terminar' : `Dictar ${etiquetaHablada(etiquetaCampo)}`
      }
      accessibilityHint={PISTA_DICTAR_CAMPO}
      accessibilityState={{ busy: escuchando }}
      style={({ pressed }) => ({
        width: OBJETIVO_TACTIL_MIN,
        height: OBJETIVO_TACTIL_MIN,
        borderRadius: radio.pastilla,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: escuchando ? c.acento : c.superficie,
        borderWidth: 1,
        borderColor: escuchando ? c.acento : c.bordeControl,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Microfono color={escuchando ? c.sobreAcento : c.acentoTexto} />
    </Pressable>
  );
}
