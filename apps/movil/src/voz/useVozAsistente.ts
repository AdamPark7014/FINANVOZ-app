import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { obtenerAjustesVoz } from '../servicios/preferencias';
import { obtenerVozRespuesta, type DatosHablados, type TurnoHablable } from '../servicios/voz-respuesta';
import { useVista } from '../sesion/ProveedorSesion';
import {
  callarVoz,
  configurarVoz,
  decirTurno,
  estaHablando,
  hablar,
  suscribirHabla,
  type FinHabla,
  type OpcionesHabla,
} from './respuesta';

/** `true` mientras el asistente habla (para animar y para cortar al tocar). */
export function useHablando(): boolean {
  const [hablando, setHablando] = useState(estaHablando);
  useEffect(() => suscribirHabla(setHablando), []);
  return hablando;
}

/** Lo último que dijo el sistema; mientras no se sabe, se supone encendido (nada se mueve de más). */
let reducirConocido: boolean | null = null;

/** Para pruebas: olvida lo que dijo el sistema. */
export function olvidarReducirMovimiento(): void {
  reducirConocido = null;
}

/** «Reducir movimiento» (iPhone) o «Quitar animaciones» (Android) encendido: nada pulsa ni ondula. */
export function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(reducirConocido ?? true);
  useEffect(() => {
    let vivo = true;
    const fijar = (v: boolean) => {
      reducirConocido = v;
      if (vivo) setReducir(v);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(fijar)
      .catch(() => fijar(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', fijar);
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);
  return reducir;
}

/** Props para la raíz de una pantalla: cualquier toque (también en hijos) corta la voz en curso. */
export const CORTAR_VOZ_AL_TOCAR = { onTouchStart: callarVoz } as const;

export interface VozAsistente {
  /** «Contestarte en voz» está encendido. */
  readonly activa: boolean;
  /**
   * Dice un turno del asistente (`fraseHablada`) si «Contestarte en voz» está encendido; resuelve al terminar.
   * Para la confirmación por voz: `await decirTurno(turnoEntendi)` y solo entonces escuchar el «sí».
   */
  readonly decirTurno: (turno: TurnoHablable, datos?: DatosHablados) => Promise<FinHabla>;
  /** Dice un texto ya en palabras, aunque «Contestarte en voz» esté apagado (lo pidió la persona). */
  readonly decir: (texto: string, o?: OpcionesHabla) => Promise<FinHabla>;
  readonly callar: () => void;
  readonly hablando: boolean;
  /** `false` con «Reducir movimiento»: sin pulsos ni ondas (`IndicadorVoz` ya lo respeta). */
  readonly animar: boolean;
  /** Para la raíz de la pantalla: `<View {...voz.cortarAlTocar}>`. */
  readonly cortarAlTocar: typeof CORTAR_VOZ_AL_TOCAR;
}

/**
 * La voz del asistente para la pantalla (Ola 7): lee Ajustes › Voz (voz, velocidad, silencio y «Contestarte en
 * voz»), dice turnos y avisa si está hablando. Va dentro de `ProveedorSesion`.
 */
export function useVozAsistente(): VozAsistente {
  const { activa } = useVista(obtenerVozRespuesta);
  const ajustes = useVista(obtenerAjustesVoz);
  const hablando = useHablando();
  const reducir = useReducirMovimiento();

  const config = useMemo(
    () => ({ voz: ajustes.voz, velocidad: ajustes.velocidad, enSilencio: ajustes.enSilencio }),
    [ajustes.voz, ajustes.velocidad, ajustes.enSilencio],
  );
  useEffect(() => configurarVoz(config), [config]);

  const decirTurnoActivo = useCallback(
    (turno: TurnoHablable, datos: DatosHablados = {}): Promise<FinHabla> =>
      activa ? decirTurno(turno, datos, config) : Promise.resolve('omitida'),
    [activa, config],
  );

  const decir = useCallback(
    (texto: string, o: OpcionesHabla = {}): Promise<FinHabla> => hablar(texto, { ...config, ...o }),
    [config],
  );

  return {
    activa,
    decirTurno: decirTurnoActivo,
    decir,
    callar: callarVoz,
    hablando,
    animar: !reducir,
    cortarAlTocar: CORTAR_VOZ_AL_TOCAR,
  };
}
