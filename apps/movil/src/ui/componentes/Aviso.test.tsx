import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { DURACION_AVISO_MS } from '../tokens';
import { Aviso, useAviso, useReservarEspacioAviso } from './Aviso';
import { Boton } from './Boton';

function Demo({ reservar = 0 }: { reservar?: number }) {
  const { aviso, mostrar, cerrar } = useAviso();
  useReservarEspacioAviso(reservar);
  return (
    <>
      <Boton
        etiqueta="Registrar"
        alPresionar={() =>
          mostrar({ mensaje: 'Registré: Coca', accion: { etiqueta: 'Deshacer', alPresionar() {} } })
        }
      />
      <Aviso aviso={aviso} alCerrar={cerrar} />
    </>
  );
}

const abrir = async (ui = <Demo />) => {
  render(ui);
  await act(async () => {});
  fireEvent.press(screen.getByRole('button', { name: 'Registrar' }));
};

describe('Aviso: tiempo para leer y actuar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('dura al menos 10 s', async () => {
    expect(DURACION_AVISO_MS).toBeGreaterThanOrEqual(10_000);
    await abrir();
    act(() => jest.advanceTimersByTime(9_900));
    expect(screen.getByTestId('aviso')).toBeTruthy();
    act(() => jest.advanceTimersByTime(100));
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('usa el tiempo que recomienda Android si es mayor (getRecommendedTimeoutMillis)', async () => {
    const recomendado = jest
      .spyOn(AccessibilityInfo, 'getRecommendedTimeoutMillis')
      .mockResolvedValueOnce(30_000);
    await abrir();
    expect(recomendado).toHaveBeenCalledWith(DURACION_AVISO_MS);
    act(() => jest.advanceTimersByTime(29_000));
    expect(screen.getByTestId('aviso')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('nunca baja de 10 s aunque Android recomiende menos', async () => {
    jest.spyOn(AccessibilityInfo, 'getRecommendedTimeoutMillis').mockResolvedValueOnce(2_000);
    await abrir();
    act(() => jest.advanceTimersByTime(9_000));
    expect(screen.getByTestId('aviso')).toBeTruthy();
  });

  it('con lector de pantalla no se cierra solo y ofrece "Cerrar aviso"', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValueOnce(true);
    await abrir();
    act(() => jest.advanceTimersByTime(120_000));
    expect(screen.getByTestId('aviso')).toBeTruthy();
    const cerrar = screen.getByRole('button', { name: 'Cerrar aviso' });
    expect(cerrar).toBeTruthy();
    fireEvent.press(cerrar);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('sin lector de pantalla no muestra "Cerrar aviso"', async () => {
    await abrir();
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).toBeNull();
  });

  it('una barra fija al pie sube el aviso para no taparla', async () => {
    await abrir(<Demo reservar={120} />);
    expect(screen.getByTestId('aviso')).toHaveStyle({ bottom: 16 + 120 });
  });
});
