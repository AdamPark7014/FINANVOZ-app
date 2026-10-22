import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Contexto, NivelNube } from '../../../servicios';
import { ProveedorSesion } from '../../../sesion/ProveedorSesion';
import type { EventoMotor, MotorDictado, OpcionesMotor } from '../../../voz';
import { ProveedorAvisos } from '../ProveedorAvisos';

/** Renderiza pantallas con la sesión real y el aviso inferior, como dentro de las pestañas. */
export function renderConSesion(ctx: Contexto, ui: ReactNode, nube: NivelNube | null = null) {
  return render(
    <ProveedorSesion ctx={ctx} nube={nube}>
      <ProveedorAvisos>{ui}</ProveedorAvisos>
    </ProveedorSesion>,
  );
}

/** Reconocedor falso: las pruebas emiten los eventos del dictado. */
export function crearMotorFalso() {
  // Como el módulo nativo: cada `useDictado` montado (panel, campos de monto) se suscribe.
  const oyentes = new Set<(e: EventoMotor) => void>();
  const motor = {
    disponible: () => true,
    soportaEnDispositivo: () => true,
    solicitarPermiso: async () => true,
    iniciar: jest.fn<undefined, [OpcionesMotor]>(),
    detener: jest.fn(),
    abortar: jest.fn(),
    suscribir: (f: (e: EventoMotor) => void) => {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
  } satisfies MotorDictado;
  const emitir = (e: EventoMotor) => act(() => oyentes.forEach((o) => o(e)));
  return { motor, emitir };
}

export const navegacionFalsa = () => ({
  alVerMovimientos: jest.fn(),
  alVerMovimiento: jest.fn(),
  alConfigurarIngreso: jest.fn(),
  alAbrirFormulario: jest.fn(),
});
