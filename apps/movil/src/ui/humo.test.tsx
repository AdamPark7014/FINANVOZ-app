import { render, screen } from '@testing-library/react-native';
import Bienvenida from '../../app/onboarding/index';
import { crearSesionPrueba } from '../pantallas/onboarding/__pruebas__/sesion';

it('renderiza la marca', () => {
  const s = crearSesionPrueba();
  render(<Bienvenida />, { wrapper: s.Envoltura });
  expect(screen.getByText(/Finanvoz/)).toBeTruthy();
  s.cerrar();
});
