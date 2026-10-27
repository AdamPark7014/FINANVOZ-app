import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Contexto, NivelNube } from '../../../servicios';
import { ProveedorSesion } from '../../../sesion/ProveedorSesion';
import { etiquetaHablada } from '../../../ui';
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

/**
 * La frase de un turno de registro como la oye el lector («Registré Coca veinticinco pesos · Antojos · Cartera.»): la
 * tarjeta de la dirección B (B2) no la muestra entera, la dice. Los turnos sin cifras se oyen como se ven. Para
 * comparar, pasa lo esperado por `oida` o `oidaDesde`.
 */
export function fraseRegistro(testID = 'aviso-texto'): string {
  const nodo = screen.getByTestId(testID);
  const etiqueta: unknown = nodo.props.accessibilityLabel;
  if (typeof etiqueta === 'string' && etiqueta !== '') return etiqueta;
  const hijos: unknown = nodo.props.children;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
}

/** Lo que dice el lector de un texto: las cifras en palabras. */
export const oida = etiquetaHablada;

/** Expresión que empieza con lo que dice el lector de `texto`. */
export function oidaDesde(texto: string): RegExp {
  return new RegExp(`^${oida(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}
