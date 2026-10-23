import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Platform, Vibration } from 'react-native';
import { crearMotorFalso } from './__pruebas__/motor-falso';
import { IndicadorVoz } from './IndicadorVoz';
import { senalEscucha, VIBRACION_ANDROID } from './senales';
import { useMicrofono } from './useMicrofono';
import { olvidarReducirMovimiento } from './useVozAsistente';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Señal táctil al escuchar', () => {
  it('Android: un toque corto al empezar y dos al terminar, una vez por dictado', async () => {
    // El preset de React Native ya trae `vibrate` como jest.fn: se limpia para contar solo esta prueba.
    const vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    vibrar.mockClear();
    const { motor, emitir } = crearMotorFalso();
    const { result } = renderHook(() => useMicrofono({ alTerminar: () => {}, motor }));
    expect(vibrar).not.toHaveBeenCalled();

    await act(() => result.current.iniciar());
    expect(result.current.escuchando).toBe(true);
    expect(vibrar).toHaveBeenCalledTimes(1);
    expect(vibrar).toHaveBeenLastCalledWith(VIBRACION_ANDROID.inicio);

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'coca 25', final: false });
    expect(vibrar).toHaveBeenCalledTimes(1);

    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });
    emitir({ tipo: 'fin' });
    expect(vibrar).toHaveBeenCalledTimes(2);
    expect(vibrar).toHaveBeenLastCalledWith(VIBRACION_ANDROID.fin);
  });

  it('las señales son cortas (ligeras): ninguna pasa de 20 ms de vibración', () => {
    const inicio = VIBRACION_ANDROID.inicio;
    expect(typeof inicio === 'number' ? inicio : 0).toBeLessThanOrEqual(20);
    const fin = VIBRACION_ANDROID.fin;
    // Patrón [espera, vibra, espera, vibra]: las posiciones impares vibran.
    expect(Array.isArray(fin) ? fin.filter((_, i) => i % 2 === 1).every((ms) => ms <= 20) : false).toBe(true);
  });

  it('iPhone sin expo-haptics en la build: no usa la vibración larga de alerta', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    // El preset de React Native ya trae `vibrate` como jest.fn: se limpia para contar solo esta prueba.
    const vibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    vibrar.mockClear();
    senalEscucha('inicio');
    senalEscucha('fin');
    expect(vibrar).not.toHaveBeenCalled();
  });
});

describe('IndicadorVoz y «Reducir movimiento»', () => {
  beforeEach(() => {
    olvidarReducirMovimiento();
  });

  it('ondula mientras escucha o habla, oculto para el lector', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const ciclo = jest.spyOn(Animated, 'loop');
    render(<IndicadorVoz activo testID="ondas" />);
    await act(async () => {});
    expect(ciclo).toHaveBeenCalled();
    expect(screen.getByTestId('ondas')).toHaveProp('accessibilityElementsHidden', true);
    expect(screen.getByTestId('ondas')).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('con «Reducir movimiento» se queda quieto (ni un instante mientras el sistema contesta)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const ciclo = jest.spyOn(Animated, 'loop');
    render(<IndicadorVoz activo testID="ondas" />);
    await act(async () => {});
    render(<IndicadorVoz activo testID="ondas-2" />);
    await act(async () => {});
    expect(ciclo).not.toHaveBeenCalled();
  });

  it('en reposo no anima', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const ciclo = jest.spyOn(Animated, 'loop');
    render(<IndicadorVoz activo={false} />);
    await act(async () => {});
    expect(ciclo).not.toHaveBeenCalled();
  });
});
