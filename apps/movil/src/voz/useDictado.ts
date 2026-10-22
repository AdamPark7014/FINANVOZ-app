import { useCallback, useEffect, useReducer, useRef } from 'react';
import { clasificarErrorMotor, ESTADO_INICIAL, reducirDictado, type EstadoDictado } from './estado';
import type { EventoMotor, MotorDictado, OpcionesMotor } from './motor';
import { motorExpo } from './motor-expo';

export const IDIOMA_DICTADO = 'es-MX';

export interface OpcionesDictado {
  /** Reconocedor; por omisión el de expo-speech-recognition. Las pruebas inyectan uno falso. */
  motor?: MotorDictado;
  /** Se llama una vez por dictado con la transcripción final (para el intérprete). */
  alTerminar?: (transcripcion: string) => void;
}

export interface OpcionesInicio {
  /**
   * Otro micrófono de la pantalla acaba de abortar el reconocedor compartido: su "abortado" y su "fin" pueden
   * llegar ya empezado este dictado. Se ignoran hasta que este dictado arranque ('inicio' o un resultado).
   */
  descartarRestos?: boolean;
}

export interface Dictado extends EstadoDictado {
  /** Pide permiso si hace falta y empieza a escuchar (al mantener presionado). */
  iniciar: (opciones?: OpcionesInicio) => Promise<void>;
  /** Deja de escuchar y espera el resultado final (al soltar). */
  detener: () => void;
  /** Descarta lo dictado. */
  cancelar: () => void;
}

/**
 * Dictado en es-MX con transcripción en vivo, en el teléfono cuando se puede (03 §3).
 * Si el reconocimiento sin red no tiene el idioma, reintenta una vez con el servicio del sistema.
 * El texto dictado nunca se registra en logs ni en reportes (regla 9).
 */
export function useDictado({ motor = motorExpo, alTerminar }: OpcionesDictado = {}): Dictado {
  const [estado, despachar] = useReducer(reducirDictado, ESTADO_INICIAL);

  const alTerminarRef = useRef(alTerminar);
  useEffect(() => {
    alTerminarRef.current = alTerminar;
  }, [alTerminar]);

  // Estado mutable del dictado en curso; solo se lee en manejadores, nunca durante el render.
  const sesion = useRef({
    activa: false,
    parcial: '',
    opciones: null as OpcionesMotor | null,
    /** Ignorar "abortado" y "fin" de otro dictado hasta que este arranque (`OpcionesInicio`). */
    esperaInicio: false,
  });

  useEffect(() => {
    const terminar = (texto: string) => {
      sesion.current.activa = false;
      const limpio = texto.trim();
      despachar({ tipo: 'final', texto: limpio });
      if (limpio !== '') alTerminarRef.current?.(limpio);
    };
    const alEvento = (e: EventoMotor) => {
      const s = sesion.current;
      if (!s.activa) return;
      switch (e.tipo) {
        case 'inicio':
          s.esperaInicio = false;
          return;
        case 'resultado':
          s.esperaInicio = false;
          if (e.final) return terminar(e.texto);
          s.parcial = e.texto;
          return despachar({ tipo: 'parcial', texto: e.texto });
        case 'sin_coincidencia':
          s.activa = false;
          return despachar({ tipo: 'error', error: 'sin_voz' });
        case 'fin':
          if (s.esperaInicio) return;
          return terminar(s.parcial);
        case 'error': {
          if (s.esperaInicio && e.codigo === 'aborted') return;
          const o = s.opciones;
          if (
            o?.enDispositivo &&
            (e.codigo === 'language-not-supported' || e.codigo === 'service-not-allowed')
          ) {
            s.opciones = { ...o, enDispositivo: false };
            motor.iniciar(s.opciones);
            return;
          }
          const clase = clasificarErrorMotor(e.codigo);
          s.activa = false;
          if (clase === null) return despachar({ tipo: 'cancelar' });
          if (clase === 'sin_permiso') return despachar({ tipo: 'sin_permiso' });
          return despachar({ tipo: 'error', error: clase });
        }
      }
    };
    const cancelar = motor.suscribir(alEvento);
    const s = sesion.current;
    return () => {
      cancelar();
      if (s.activa) {
        s.activa = false;
        motor.abortar();
      }
    };
  }, [motor]);

  const iniciar = useCallback(
    async ({ descartarRestos = false }: OpcionesInicio = {}) => {
      if (sesion.current.activa) return;
      if (!motor.disponible()) {
        despachar({ tipo: 'error', error: 'no_disponible' });
        return;
      }
      const concedido = await motor.solicitarPermiso();
      if (!concedido) {
        despachar({ tipo: 'sin_permiso' });
        return;
      }
      const opciones: OpcionesMotor = {
        idioma: IDIOMA_DICTADO,
        resultadosParciales: true,
        enDispositivo: motor.soportaEnDispositivo(),
      };
      Object.assign(sesion.current, { activa: true, parcial: '', opciones, esperaInicio: descartarRestos });
      despachar({ tipo: 'escuchar' });
      motor.iniciar(opciones);
    },
    [motor],
  );

  const detener = useCallback(() => {
    if (!sesion.current.activa) return;
    despachar({ tipo: 'detener' });
    motor.detener();
  }, [motor]);

  const cancelar = useCallback(() => {
    if (!sesion.current.activa) return;
    sesion.current.activa = false;
    despachar({ tipo: 'cancelar' });
    motor.abortar();
  }, [motor]);

  return { ...estado, iniciar, detener, cancelar };
}
