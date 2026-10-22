import { render } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { anunciar, useAnunciar } from './index';

let anuncio: jest.SpyInstance;
beforeEach(() => {
  // `AccessibilityInfo` ya es un mock del setup de RN: se limpian sus llamadas en cada prueba.
  anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  anuncio.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('anunciar (VoiceOver no lee regiones vivas)', () => {
  it('Android: no hace nada (lo lee TalkBack por la región viva)', () => {
    anunciar('Listo.');
    expect(anuncio).not.toHaveBeenCalled();
  });

  it('iPhone: anuncia el texto; vacío no', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    anunciar('   ');
    expect(anuncio).not.toHaveBeenCalled();
    anunciar('Listo.');
    expect(anuncio).toHaveBeenCalledWith('Listo.');
  });

  it('useAnunciar: anuncia al aparecer y al cambiar, no al repetirse ni con vacío', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const Prueba = ({ texto }: { texto: string | null }) => {
      useAnunciar(texto);
      return null;
    };
    const { rerender } = render(<Prueba texto={null} />);
    expect(anuncio).not.toHaveBeenCalled();
    rerender(<Prueba texto="No pude guardar. Intenta de nuevo." />);
    rerender(<Prueba texto="No pude guardar. Intenta de nuevo." />);
    expect(anuncio).toHaveBeenCalledTimes(1);
    rerender(<Prueba texto="Listo." />);
    expect(anuncio).toHaveBeenLastCalledWith('Listo.');
    expect(anuncio).toHaveBeenCalledTimes(2);
  });
});
