import { act } from '@testing-library/react-native';
import type { EventoMotor, MotorDictado, OpcionesMotor } from '../motor';

export interface OpcionesMotorFalso {
  /** `false`: el teléfono no tiene reconocimiento (no aparece el micrófono de los campos). */
  disponible?: boolean;
  /** `false`: la persona negó el micrófono. */
  permiso?: boolean;
  enDispositivo?: boolean;
}

/**
 * Reconocedor falso para pruebas: las pruebas emiten los eventos del dictado. Admite varios oyentes a la vez
 * (como el módulo nativo), para pantallas con más de un micrófono (registro y campos de dinero).
 */
export function crearMotorFalso({
  disponible = true,
  permiso = true,
  enDispositivo = true,
}: OpcionesMotorFalso = {}) {
  const oyentes = new Set<(e: EventoMotor) => void>();
  const motor = {
    disponible: jest.fn(() => disponible),
    soportaEnDispositivo: jest.fn(() => enDispositivo),
    solicitarPermiso: jest.fn(async () => permiso),
    iniciar: jest.fn<undefined, [OpcionesMotor]>(),
    detener: jest.fn(),
    abortar: jest.fn(),
    suscribir: jest.fn((f: (e: EventoMotor) => void) => {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    }),
  } satisfies MotorDictado;
  /** Entrega el evento a todos los suscritos, dentro de `act`. */
  const emitir = (e: EventoMotor) =>
    act(() => {
      for (const f of [...oyentes]) f(e);
    });
  return { motor, emitir, oyentes: () => oyentes.size };
}
