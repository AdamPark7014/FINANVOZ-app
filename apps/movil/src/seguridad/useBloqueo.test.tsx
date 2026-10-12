import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { Autenticador, ResultadoAutenticacion } from './autenticador';
import type { EstadoApp } from './bloqueo';
import { CortinaBloqueo } from './CortinaBloqueo';
import * as ScreenCapture from 'expo-screen-capture';
import { capturaExpo, LLAVE_MULTITAREA, useOcultarEnMultitarea, type ControlCaptura } from './multitarea';
import { useBloqueo, type FuenteEstadoApp, type OpcionesBloqueo } from './useBloqueo';

const T0 = 1_760_000_000_000;

function preparar(resultados: ResultadoAutenticacion[] = [{ exito: true }]) {
  let ahora = T0;
  let oyente: ((e: EstadoApp) => void) | null = null;
  const estadoApp: FuenteEstadoApp = {
    suscribir: (f) => {
      oyente = f;
      return () => {
        oyente = null;
      };
    },
  };
  const cola = [...resultados];
  const autenticar = jest.fn(async () => cola.shift() ?? { exito: true as const });
  const autenticador: Autenticador = { disponible: async () => true, autenticar };
  const opciones = {
    reloj: () => ahora,
    estadoApp,
    autenticador,
  } satisfies Partial<OpcionesBloqueo>;
  return {
    opciones,
    autenticar,
    avanzar: (ms: number) => {
      ahora += ms;
    },
    cambiar: async (e: EstadoApp) => {
      await act(async () => oyente?.(e));
    },
  };
}

describe('useBloqueo (CA-M2-11)', () => {
  it('al volver tras ≥ 1 min en segundo plano pide biometría o PIN', async () => {
    const p = preparar();
    const { result } = renderHook(() =>
      useBloqueo({ activo: true, bloquearAlIniciar: false, ...p.opciones }),
    );
    expect(result.current.bloqueado).toBe(false);

    await p.cambiar('background');
    p.avanzar(60_000);
    p.autenticar.mockImplementationOnce(() => new Promise(() => {}));
    await p.cambiar('active');
    expect(result.current.bloqueado).toBe(true);
    expect(result.current.autenticando).toBe(true);
    expect(p.autenticar).toHaveBeenCalledTimes(1);
  });

  it('al volver antes de 1 min no pide nada', async () => {
    const p = preparar();
    const { result } = renderHook(() =>
      useBloqueo({ activo: true, bloquearAlIniciar: false, ...p.opciones }),
    );
    await p.cambiar('background');
    p.avanzar(59_000);
    await p.cambiar('active');
    expect(result.current.bloqueado).toBe(false);
    expect(p.autenticar).not.toHaveBeenCalled();
  });

  it('con el bloqueo apagado nunca bloquea', async () => {
    const p = preparar();
    const { result } = renderHook(() => useBloqueo({ activo: false, ...p.opciones }));
    expect(result.current.bloqueado).toBe(false);
    await p.cambiar('background');
    p.avanzar(10 * 60_000);
    await p.cambiar('active');
    expect(result.current.bloqueado).toBe(false);
    expect(p.autenticar).not.toHaveBeenCalled();
  });

  it('al abrir en frío pide autenticación y desbloquea si es correcta', async () => {
    const p = preparar([{ exito: true }]);
    const { result } = renderHook(() => useBloqueo({ activo: true, ...p.opciones }));
    await act(async () => {});
    expect(p.autenticar).toHaveBeenCalledTimes(1);
    expect(result.current.bloqueado).toBe(false);
  });

  it('si cancela, sigue bloqueada con mensaje y puede reintentar', async () => {
    const p = preparar([{ exito: false, error: 'cancelado' }, { exito: true }]);
    const { result } = renderHook(() => useBloqueo({ activo: true, ...p.opciones }));
    await act(async () => {});
    expect(result.current).toMatchObject({ bloqueado: true, error: 'cancelado' });
    await act(() => result.current.desbloquear());
    expect(result.current).toMatchObject({ bloqueado: false, error: null });
  });

  it('las salidas mientras el aviso del sistema está abierto no cuentan', async () => {
    const p = preparar();
    let resolver: (r: ResultadoAutenticacion) => void = () => {};
    p.autenticar.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );
    const { result } = renderHook(() => useBloqueo({ activo: true, ...p.opciones }));
    await act(async () => {});
    // La pantalla del PIN en Android manda la app a segundo plano.
    await p.cambiar('background');
    p.avanzar(70_000);
    await p.cambiar('active');
    await act(async () => resolver({ exito: true }));
    expect(result.current.bloqueado).toBe(false);
    expect(p.autenticar).toHaveBeenCalledTimes(1);
  });

  it('apagar el bloqueo libera la app sin autenticación', async () => {
    const p = preparar([{ exito: false, error: 'cancelado' }]);
    const { result, rerender } = renderHook(
      (props: { activo: boolean }) => useBloqueo({ activo: props.activo, ...p.opciones }),
      { initialProps: { activo: true } },
    );
    await act(async () => {});
    expect(result.current.bloqueado).toBe(true);
    rerender({ activo: false });
    expect(result.current.bloqueado).toBe(false);
  });
});

describe('CortinaBloqueo', () => {
  it('cubre la app y ofrece Desbloquear', async () => {
    const p = preparar([{ exito: false, error: 'demasiados_intentos' }, { exito: true }]);
    function App() {
      const bloqueo = useBloqueo({ activo: true, ...p.opciones });
      return <CortinaBloqueo bloqueo={bloqueo} />;
    }
    render(<App />);
    await act(async () => {});
    expect(screen.getByText('Finanvoz está bloqueada')).toBeTruthy();
    expect(screen.getByText(/muchos intentos/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    });
    expect(screen.queryByTestId('cortina-bloqueo')).toBeNull();
  });
});

describe('useOcultarEnMultitarea', () => {
  it('oculta mientras está activo y lo revierte al apagarlo', async () => {
    const control: ControlCaptura = {
      ocultar: jest.fn(async () => {}),
      mostrar: jest.fn(async () => {}),
    };
    const { rerender } = renderHook(
      (props: { activo: boolean }) => useOcultarEnMultitarea(props.activo, control),
      { initialProps: { activo: false } },
    );
    expect(control.ocultar).not.toHaveBeenCalled();
    rerender({ activo: true });
    expect(control.ocultar).toHaveBeenCalledTimes(1);
    rerender({ activo: false });
    expect(control.mostrar).toHaveBeenCalledTimes(1);
  });

  it('el control real usa FLAG_SECURE en Android', async () => {
    await capturaExpo.ocultar();
    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith(LLAVE_MULTITAREA);
    await capturaExpo.mostrar();
    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith(LLAVE_MULTITAREA);
  });
});

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
  enableAppSwitcherProtectionAsync: jest.fn(async () => {}),
  disableAppSwitcherProtectionAsync: jest.fn(async () => {}),
}));
