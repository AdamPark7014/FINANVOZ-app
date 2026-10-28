import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { MENSAJES_DICTADO, type ClaveMensajeDictado } from './estado';
import type { MotorDictado } from './motor';
import { motorExpo } from './motor-expo';
import { useDictador } from './dictador';
import { callarVoz } from './respuesta';
import { senalEscucha } from './senales';
import { useBotonHablar, type BotonHablar } from './useBotonHablar';
import { useDictado } from './useDictado';

/** Qué decir ante cada error del dictado (02-UX §14: qué pasó + qué hacer). */
export type MensajesDictado = Readonly<Record<ClaveMensajeDictado, string>>;

export interface OpcionesMicrofono {
  /** Se llama una vez por dictado con la transcripción final. */
  alTerminar: (transcripcion: string) => void;
  /** Reconocedor explícito (pruebas); si no, el de `ProveedorDictado`, y sin proveedor el de Expo. */
  motor?: MotorDictado;
  /** Por omisión los del registro (`MENSAJES_DICTADO`). */
  mensajes?: MensajesDictado;
}

export interface Microfono {
  /** El teléfono tiene reconocimiento de voz. */
  disponible: boolean;
  /** Escuchando o terminando de procesar lo dicho. */
  escuchando: boolean;
  /** Transcripción en vivo; solo a la vista (puede traer cifras a medias). */
  parcial: string;
  /** Error del último dictado, listo para mostrar; `null` si no hubo. */
  aviso: string | null;
  /** Se negó el micrófono (o el reconocimiento): hay que ofrecer "Abrir Ajustes". */
  sinPermiso: boolean;
  /** Manejadores del botón: toca para hablar, toca para terminar, mantener y soltar, acción de TalkBack. */
  boton: BotonHablar;
  /** Empieza a escuchar (callando la respuesta en voz y cualquier otro micrófono). */
  iniciar: () => Promise<void>;
  /** Descarta lo dictado. */
  cancelar: () => void;
  /** El volumen mientras escucha (0 a 1) para la onda de «Te escucho»; `null` si el reconocedor no lo da. */
  suscribirVolumen: ((alNivel: (nivel: number) => void) => () => void) | null;
}

/**
 * Ajustes de la app en el teléfono. Con el permiso negado iOS no vuelve a mostrar el diálogo: la única
 * salida es que la persona lo active ahí.
 */
export function abrirAjustesDictado(): void {
  Linking.openSettings().catch(() => {});
}

/**
 * Un micrófono de la pantalla: dictado en es-MX (`useDictado`) + botón (`useBotonHablar`) + mensaje de error.
 * Con `ProveedorDictado` se registra para que solo uno escuche a la vez: el que empieza calla al anterior.
 * Lo dictado nunca va a logs (regla 9).
 */
export function useMicrofono({
  alTerminar,
  motor: motorPropio,
  mensajes = MENSAJES_DICTADO,
}: OpcionesMicrofono): Microfono {
  const dictador = useDictador();
  const motor = motorPropio ?? dictador?.motor ?? motorExpo;
  const id = useId();
  const {
    estado,
    parcial,
    error,
    iniciar: iniciarDictado,
    detener,
    cancelar,
  } = useDictado({
    motor,
    alTerminar,
  });
  const escuchando = estado === 'escuchando' || estado === 'procesando';
  const disponible = useMemo(() => motor.disponible(), [motor]);

  const iniciar = useCallback(() => {
    const calloAOtro = dictador?.tomar(id, cancelar) ?? false;
    callarVoz();
    return iniciarDictado(calloAOtro ? { descartarRestos: true } : {});
  }, [dictador, id, cancelar, iniciarDictado]);

  // Terminó, falló, no hubo permiso o lo calló otro: deja libre el reconocedor.
  useEffect(() => {
    if (estado !== 'escuchando' && estado !== 'procesando') dictador?.liberar(id);
  }, [dictador, id, estado]);
  useEffect(() => () => dictador?.liberar(id), [dictador, id]);

  // Vibración ligera al empezar a escuchar y al dejar de hacerlo (`voz/senales`), una vez por dictado.
  const vibro = useRef(false);
  useEffect(() => {
    if (estado === 'escuchando' && !vibro.current) {
      vibro.current = true;
      senalEscucha('inicio');
    } else if (estado !== 'escuchando' && vibro.current) {
      vibro.current = false;
      senalEscucha('fin');
    }
  }, [estado]);

  const boton = useBotonHablar({ escuchando, iniciar, detener, cancelar });
  const suscribirVolumen = useMemo(
    () =>
      motor.suscribirVolumen
        ? (alNivel: (nivel: number) => void) => motor.suscribirVolumen?.(alNivel) ?? (() => {})
        : null,
    [motor],
  );
  const sinPermiso = estado === 'sin_permiso';
  // iOS pide dos permisos (micrófono y reconocimiento de voz); el mensaje los nombra.
  const aviso = sinPermiso
    ? Platform.OS === 'ios'
      ? mensajes.sin_permiso_ios
      : mensajes.sin_permiso
    : error
      ? mensajes[error]
      : null;
  return { disponible, escuchando, parcial, aviso, sinPermiso, boton, iniciar, cancelar, suscribirVolumen };
}
