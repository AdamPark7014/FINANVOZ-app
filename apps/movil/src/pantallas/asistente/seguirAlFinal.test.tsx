import { act, renderHook } from '@testing-library/react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { estaAlFinal, UMBRAL_FINAL, useSeguirAlFinal } from './seguirAlFinal';

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } }) as LayoutChangeEvent;
const scroll = (offsetY: number, contenido: number, visible: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offsetY },
      contentSize: { width: 390, height: contenido },
      layoutMeasurement: { width: 390, height: visible },
    },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

function montar() {
  const scrollToEnd = jest.fn();
  const lista = { current: { scrollToEnd } };
  const { result } = renderHook(() => useSeguirAlFinal(lista));
  return { scrollToEnd, h: () => result.current };
}

describe('la conversación termina en lo último (auditoría H1)', () => {
  it('cuenta como final lo que queda dentro del umbral', () => {
    expect(estaAlFinal(600, 1000, 400)).toBe(true);
    expect(estaAlFinal(600 - UMBRAL_FINAL, 1000, 400)).toBe(true);
    expect(estaAlFinal(600 - UMBRAL_FINAL - 1, 1000, 400)).toBe(false);
  });

  it('si la barra de voz crece y se achica lo visible, vuelve a bajar a lo último', () => {
    const { scrollToEnd, h } = montar();
    act(() => h().onLayout(layout(520)));
    scrollToEnd.mockClear();
    // Vuelven los chips y el micrófono: la conversación pierde 120 pt de alto.
    act(() => h().onLayout(layout(400)));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it('no mueve a quien subió a leer turnos anteriores', () => {
    const { scrollToEnd, h } = montar();
    act(() => h().onLayout(layout(520)));
    act(() => h().onScroll(scroll(100, 1600, 520)));
    scrollToEnd.mockClear();
    act(() => h().onLayout(layout(400)));
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('un turno nuevo siempre se muestra, aunque la persona estuviera leyendo arriba', () => {
    const { scrollToEnd, h } = montar();
    act(() => h().onScroll(scroll(100, 1600, 520)));
    act(() => h().onContentSizeChange());
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
    // Y vuelve a seguir el final: el siguiente cambio de alto también baja.
    scrollToEnd.mockClear();
    act(() => h().onLayout(layout(400)));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it('un layout con el mismo alto no desplaza', () => {
    const { scrollToEnd, h } = montar();
    act(() => h().onLayout(layout(400)));
    scrollToEnd.mockClear();
    act(() => h().onLayout(layout(400)));
    expect(scrollToEnd).not.toHaveBeenCalled();
  });
});
