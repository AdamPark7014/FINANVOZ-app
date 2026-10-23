import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  BTN_REINTENTAR_PANTALLA,
  CODIGO_ERROR_PANTALLA,
  PantallaError,
  TEXTO_ERROR_PANTALLA,
  TITULO_ERROR_PANTALLA,
} from './PantallaError';

const mockCaptureMessage = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

describe('PantallaError (límite de errores de la raíz)', () => {
  it('explica, ofrece reintentar y reporta solo el código y el tipo', () => {
    const captura = mockCaptureMessage;
    const retry = jest.fn(() => Promise.resolve());
    const error = new TypeError('saldo de Juan: $4,200');
    render(<PantallaError error={error} retry={retry} />);
    expect(screen.getByText(TITULO_ERROR_PANTALLA)).toBeTruthy();
    expect(screen.getByText(TEXTO_ERROR_PANTALLA)).toBeTruthy();
    fireEvent.press(screen.getByTestId('pantalla-error-reintentar'));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(BTN_REINTENTAR_PANTALLA)).toBeTruthy();
    expect(captura).toHaveBeenCalledWith(CODIGO_ERROR_PANTALLA, {
      level: 'error',
      tags: { tipo: 'TypeError' },
    });
    // Nada del mensaje (montos, nombres) sale del teléfono.
    expect(JSON.stringify(captura.mock.calls)).not.toContain('Juan');
  });
});
