import { useEffect, useMemo } from 'react';
import { BotonMicrofono } from '../ui/componentes/BotonMicrofono';
import type { PropsBotonDictarCampo } from '../ui/componentes/dictado-campo';
import { useDictador } from './dictador';
import type { MotorDictado } from './motor';
import { motorExpo } from './motor-expo';
import {
  etiquetaMicrofonoCampo,
  MENSAJES_DICTADO_CAMPO,
  MENSAJES_DICTADO_FRASE,
  PISTA_MICROFONO_CAMPO,
  PISTA_MICROFONO_FRASE,
  textoOyendoCampo,
} from './textos';
import { useMicrofono } from './useMicrofono';

type Props = PropsBotonDictarCampo & {
  /** Reconocedor explícito (pruebas); si no, el de `ProveedorDictado`, y sin proveedor el de Expo. */
  motor?: MotorDictado;
};

const SEGUN_LO_QUE_DICTA = {
  cifra: { mensajes: MENSAJES_DICTADO_CAMPO, pista: PISTA_MICROFONO_CAMPO },
  frase: { mensajes: MENSAJES_DICTADO_FRASE, pista: PISTA_MICROFONO_FRASE },
} as const;

/**
 * El micrófono de un campo (`CampoMonto`) o de «O dímelo»: es `BotonMicrofono` (48 dp, toca o mantén, acción
 * «activar» del lector) sobre `useMicrofono`, el mismo reconocedor de toda la app, así que solo uno escucha a la vez
 * y un dictado abortado no le llega al nuevo. Avisa al campo lo que se va oyendo, el error o la falta de permiso;
 * la transcripción final va a `alOir` y nunca a logs (regla 9). Sin reconocimiento en el teléfono no se muestra ni
 * se suscribe al reconocedor.
 */
export function BotonDictarCampo({ motor: motorPropio, ...props }: Props) {
  const dictador = useDictador();
  const motor = motorPropio ?? dictador?.motor ?? motorExpo;
  const disponible = useMemo(() => motor.disponible(), [motor]);
  if (!disponible) return null;
  return <MicrofonoDeCampo {...props} motor={motor} />;
}

function MicrofonoDeCampo({
  etiquetaCampo,
  alOir,
  alAviso,
  dicta = 'cifra',
  testID,
  motor,
}: PropsBotonDictarCampo & { motor: MotorDictado }) {
  const { mensajes, pista } = SEGUN_LO_QUE_DICTA[dicta];
  const mic = useMicrofono({ alTerminar: alOir, motor, mensajes });
  const { escuchando, parcial, aviso, sinPermiso } = mic;
  const texto = escuchando ? textoOyendoCampo(parcial) : aviso;
  const negado = !escuchando && sinPermiso;
  useEffect(() => {
    alAviso(texto === null ? null : { texto, escuchando, sinPermiso: negado });
  }, [alAviso, texto, escuchando, negado]);
  // Si el micrófono desaparece (el campo se deshabilita), el campo deja de mostrar lo que se iba oyendo.
  useEffect(() => () => alAviso(null), [alAviso]);
  return (
    <BotonMicrofono
      forma="icono"
      escuchando={escuchando}
      boton={mic.boton}
      etiqueta={etiquetaMicrofonoCampo(etiquetaCampo)}
      pista={pista}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}
