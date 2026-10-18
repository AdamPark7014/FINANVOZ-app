import { screen } from '@testing-library/react-native';
import { renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { FormularioMovimiento } from './FormularioMovimiento';
import { PISTA_GUARDAR_MOVIMIENTO } from './formularioMovimiento-textos';

describe('FormularioMovimiento (TalkBack)', () => {
  it('Guardar trae accessibilityHint (`02 §15`)', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <FormularioMovimiento />);
    expect(screen.getByTestId('boton-guardar-movimiento')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_MOVIMIENTO,
    );
    p.cerrar();
  });
});
