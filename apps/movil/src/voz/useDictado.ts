import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { clasificarErrorMotor, ESTADO_INICIAL, reducirDictado, type EstadoDictado } from './estado';
import type { EventoMotor, MotorDictado, OpcionesMotor } from './motor';
import { motorExpo } from './motor-expo';

export const IDIOMA_DICTADO = 'es-MX';

/**
 * Un solo dictado a la vez en toda la app: el reconocedor es uno y todos los `useDictado` oyen sus eventos. Quien
 * empieza a escuchar suelta al anterior (p. ej. el micrófono de un campo mientras Hoy escuchaba).
 */
let soltarDuenoActual: (() => void) | null = null;

export interface OpcionesDictado {
  /** Reconocedor; por omisión el de expo-speech-recognition. Las pruebas inyectan uno falso. */
  motor?: MotorDictado;
  /** Se llama una vez por dictado con la transcripción final (para el intérprete). */
  alTerminar?: (transcripcion: string) => void;
}

export interface Dictado extends EstadoDictado {
  /** Pide permiso si hace falta y empieza a escuchar (al mantener presionado). */
  iniciar: () => Promise<void>;
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
  const sesion = useRef({ activa: false, parcial: '', opciones: null as OpcionesMotor | null });
  // Estable por instancia: suelta este dictado sin tocar el reconocedor (quien lo toma lo reinicia).
  const [soltar] = useState(() => () => {
    if (!sesion.current.activa) return;
    sesion.current.activa = false;
    despachar({ tipo: 'cancelar' });
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
          return;
        case 'resultado':
          if (e.final) return terminar(e.texto);
          s.parcial = e.texto;
          return despachar({ tipo: 'parcial', texto: e.texto });
        case 'sin_coincidencia':
          s.activa = false;
          return despachar({ tipo: 'error', error: 'sin_voz' });
        case 'fin':
          return terminar(s.parcial);
        case 'error': {
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
      if (soltarDuenoActual === soltar) soltarDuenoActual = null;
      if (s.activa) {
        s.activa = false;
        motor.abortar();
      }
    };
  }, [motor, soltar]);

  const iniciar = useCallback(async () => {
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
    if (soltarDuenoActual && soltarDuenoActual !== soltar) {
      soltarDuenoActual();
      motor.abortar();
    }
    soltarDuenoActual = soltar;
    Object.assign(sesion.current, { activa: true, parcial: '', opciones });
    despachar({ tipo: 'escuchar' });
    motor.iniciar(opciones);
  }, [motor, soltar]);

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
