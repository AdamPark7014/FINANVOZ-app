import { act, render, renderHook, screen } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';
import { comprobarParaActivar } from './activar';
import type { Autenticador, ResultadoAutenticacion } from './autenticador';
import { CortinaBloqueo } from './CortinaBloqueo';
import { capturaExpo, INTENSIDAD_DIFUMINADO_IOS } from './multitarea';
import { useBloqueo, type FuenteEstadoApp } from './useBloqueo';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
  enableAppSwitcherProtectionAsync: jest.fn(async () => {}),
  disableAppSwitcherProtectionAsync: jest.fn(async () => {}),
}));

const sinCambios: FuenteEstadoApp = { suscribir: () => () => {} };

function autenticador(
  disponible: boolean,
  resultado: ResultadoAutenticacion,
): Autenticador & {
  autenticar: jest.Mock;
} {
  return { disponible: async () => disponible, autenticar: jest.fn(async () => resultado) };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('encender el bloqueo (auditoría iPhone)', () => {
  it('sin biometría ni código no pide nada y dice sin_seguridad', async () => {
    const a = autenticador(false, { exito: true });
    expect(await comprobarParaActivar(a)).toEqual({ activado: false, motivo: 'sin_seguridad' });
    expect(a.autenticar).not.toHaveBeenCalled();
  });

  it('con código exige un desbloqueo con éxito', async () => {
    expect(await comprobarParaActivar(autenticador(true, { exito: true }))).toEqual({ activado: true });
    expect(await comprobarParaActivar(autenticador(true, { exito: false, error: 'cancelado' }))).toEqual({
      activado: false,
      motivo: 'cancelado',
    });
    const roto: Autenticador = {
      disponible: async () => true,
      autenticar: async () => {
        throw new Error('nativo');
      },
    };
    expect(await comprobarParaActivar(roto)).toEqual({ activado: false, motivo: 'fallo' });
  });
});

describe('la cortina nunca se queda puesta para siempre', () => {
  it('si el teléfono ya no tiene código, entra y avisa para apagar el bloqueo', async () => {
    const alSinSeguridad = jest.fn();
    const a = autenticador(false, { exito: false, error: 'sin_seguridad' });
    const { result } = renderHook(() =>
      useBloqueo({ activo: true, autenticador: a, estadoApp: sinCambios, alSinSeguridad }),
    );
    await act(async () => {});
    expect(result.current.bloqueado).toBe(false);
    expect(result.current.sinSeguridad).toBe(true);
    expect(alSinSeguridad).toHaveBeenCalledTimes(1);
  });

  it('un sin_seguridad suelto con el teléfono protegido no se salta el bloqueo', async () => {
    const a = autenticador(true, { exito: false, error: 'sin_seguridad' });
    const { result } = renderHook(() => useBloqueo({ activo: true, autenticador: a, estadoApp: sinCambios }));
    await act(async () => {});
    expect(result.current.bloqueado).toBe(true);
    expect(result.current.sinSeguridad).toBe(false);
    expect(result.current.error).toBe('sin_seguridad');
  });

  it('en iPhone la cortina habla de Face ID y del código', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const a = autenticador(true, { exito: false, error: 'demasiados_intentos' });
    function App() {
      const bloqueo = useBloqueo({ activo: true, autenticador: a, estadoApp: sinCambios });
      return <CortinaBloqueo bloqueo={bloqueo} />;
    }
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toHaveProp(
      'accessibilityHint',
      'Usa Face ID o el código del iPhone',
    );
  });
});

describe('ocultar en multitarea en iPhone', () => {
  it('difumina al máximo el selector de apps', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await capturaExpo.ocultar();
    expect(ScreenCapture.enableAppSwitcherProtectionAsync).toHaveBeenCalledWith(INTENSIDAD_DIFUMINADO_IOS);
    expect(INTENSIDAD_DIFUMINADO_IOS).toBe(1);
    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();
    await capturaExpo.mostrar();
    expect(ScreenCapture.disableAppSwitcherProtectionAsync).toHaveBeenCalled();
  });
});
