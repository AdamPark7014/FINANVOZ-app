import { render, screen } from '@testing-library/react-native';
import Inicio from '../../app/index';

it('renderiza la marca', () => {
  render(<Inicio />);
  expect(screen.getByText('Finanvoz')).toBeTruthy();
});
