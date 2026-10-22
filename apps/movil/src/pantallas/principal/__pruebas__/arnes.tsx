import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Contexto, NivelNube } from '../../../servicios';
import { ProveedorSesion } from '../../../sesion/ProveedorSesion';
import { ProveedorAvisos } from '../ProveedorAvisos';

/** Renderiza pantallas con la sesión real y el aviso inferior, como dentro de las pestañas. */
export function renderConSesion(ctx: Contexto, ui: ReactNode, nube: NivelNube | null = null) {
  return render(
    <ProveedorSesion ctx={ctx} nube={nube}>
      <ProveedorAvisos>{ui}</ProveedorAvisos>
    </ProveedorSesion>,
  );
}

/** Reconocedor falso: las pruebas emiten los eventos del dictado (a todos los micrófonos suscritos). */
export { crearMotorFalso } from '../../../voz/__pruebas__/motor-falso';

export const navegacionFalsa = () => ({
  alVerMovimientos: jest.fn(),
  alVerMovimiento: jest.fn(),
  alConfigurarIngreso: jest.fn(),
  alAbrirFormulario: jest.fn(),
});
