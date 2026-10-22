import { act, renderHook } from '@testing-library/react-native';
import type { EventoMotor, MotorDictado, OpcionesMotor } from './motor';
import { motorExpo } from './motor-expo';
import { useDictado } from './useDictado';

function crearMotorFalso({
  disponible = true,
  permiso = true,
  enDispositivo = true,
}: { disponible?: boolean; permiso?: boolean; enDispositivo?: boolean } = {}) {
  let oyente: ((e: EventoMotor) => void) | null = null;
  const motor = {
    disponible: jest.fn(() => disponible),
    soportaEnDispositivo: jest.fn(() => enDispositivo),
    solicitarPermiso: jest.fn(async () => permiso),
    iniciar: jest.fn<undefined, [OpcionesMotor]>(),
    detener: jest.fn(),
    abortar: jest.fn(),
    suscribir: jest.fn((f: (e: EventoMotor) => void) => {
      oyente = f;
      return () => {
        oyente = null;
      };
    }),
  } satisfies MotorDictado;
  const emitir = (e: EventoMotor) => act(() => oyente?.(e));
  return { motor, emitir };
}

describe('useDictado', () => {
  it('escucha en es-MX en el dispositivo con resultados parciales y entrega la transcripción final', async () => {
    const { motor, emitir } = crearMotorFalso();
    const alTerminar = jest.fn();
    const { result } = renderHook(() => useDictado({ motor, alTerminar }));
    expect(result.current.estado).toBe('inactivo');

    await act(() => result.current.iniciar());
    expect(motor.iniciar).toHaveBeenCalledWith({
      idioma: 'es-MX',
      resultadosParciales: true,
      enDispositivo: true,
    });
    expect(result.current.estado).toBe('escuchando');

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'coca 25', final: false });
    expect(result.current.parcial).toBe('coca 25');

    act(() => result.current.detener());
    expect(motor.detener).toHaveBeenCalled();
    expect(result.current.estado).toBe('procesando');

    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });
    emitir({ tipo: 'fin' });
    expect(result.current.estado).toBe('inactivo');
    expect(result.current.transcripcion).toBe('coca 25 en efectivo');
    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar).toHaveBeenCalledWith('coca 25 en efectivo');
  });

  it('sin permiso no empieza a escuchar', async () => {
    const { motor } = crearMotorFalso({ permiso: false });
    const { result } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    expect(result.current.estado).toBe('sin_permiso');
    expect(motor.iniciar).not.toHaveBeenCalled();
  });

  it('permiso revocado durante el dictado → sin_permiso', async () => {
    const { motor, emitir } = crearMotorFalso();
    const { result } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    emitir({ tipo: 'error', codigo: 'not-allowed' });
    expect(result.current.estado).toBe('sin_permiso');
  });

  it('sin reconocedor → error no_disponible', async () => {
    const { motor } = crearMotorFalso({ disponible: false });
    const { result } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    expect(result.current).toMatchObject({ estado: 'error', error: 'no_disponible' });
    expect(motor.solicitarPermiso).not.toHaveBeenCalled();
  });

  it('si el idioma no está en el dispositivo, reintenta una vez con el servicio del sistema', async () => {
    const { motor, emitir } = crearMotorFalso();
    const { result } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    emitir({ tipo: 'error', codigo: 'language-not-supported' });
    expect(motor.iniciar).toHaveBeenLastCalledWith(expect.objectContaining({ enDispositivo: false }));
    expect(result.current.estado).toBe('escuchando');
    emitir({ tipo: 'error', codigo: 'language-not-supported' });
    expect(result.current).toMatchObject({ estado: 'error', error: 'no_disponible' });
  });

  it('no escuchar nada es "sin voz"', async () => {
    const { motor, emitir } = crearMotorFalso();
    const alTerminar = jest.fn();
    const { result } = renderHook(() => useDictado({ motor, alTerminar }));
    await act(() => result.current.iniciar());
    emitir({ tipo: 'error', codigo: 'no-speech' });
    emitir({ tipo: 'fin' });
    expect(result.current).toMatchObject({ estado: 'error', error: 'sin_voz' });
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('cancelar aborta y descarta', async () => {
    const { motor, emitir } = crearMotorFalso();
    const alTerminar = jest.fn();
    const { result } = renderHook(() => useDictado({ motor, alTerminar }));
    await act(() => result.current.iniciar());
    emitir({ tipo: 'resultado', texto: 'coca', final: false });
    act(() => result.current.cancelar());
    expect(motor.abortar).toHaveBeenCalled();
    emitir({ tipo: 'error', codigo: 'aborted' });
    emitir({ tipo: 'fin' });
    expect(result.current).toMatchObject({ estado: 'inactivo', parcial: '', transcripcion: null });
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('tras callar a otro micrófono, ignora su "abortado" y su "fin" hasta que este dictado arranca', async () => {
    const { motor, emitir } = crearMotorFalso();
    const alTerminar = jest.fn();
    const { result } = renderHook(() => useDictado({ motor, alTerminar }));
    await act(() => result.current.iniciar({ descartarRestos: true }));
    emitir({ tipo: 'error', codigo: 'aborted' });
    emitir({ tipo: 'fin' });
    expect(result.current.estado).toBe('escuchando');

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'quinientos', final: true });
    expect(alTerminar).toHaveBeenCalledWith('quinientos');
    expect(result.current.estado).toBe('inactivo');
  });

  it('sin descartarRestos, un "abortado" ajeno sí corta (comportamiento de siempre)', async () => {
    const { motor, emitir } = crearMotorFalso();
    const { result } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    emitir({ tipo: 'error', codigo: 'aborted' });
    expect(result.current.estado).toBe('inactivo');
  });

  it('al desmontar mientras escucha, aborta', async () => {
    const { motor } = crearMotorFalso();
    const { result, unmount } = renderHook(() => useDictado({ motor }));
    await act(() => result.current.iniciar());
    unmount();
    expect(motor.abortar).toHaveBeenCalled();
  });

  it('el motor real se reporta no disponible sin el módulo nativo (Jest)', () => {
    expect(motorExpo.disponible()).toBe(false);
    expect(motorExpo.suscribir(() => {})).toEqual(expect.any(Function));
  });
});
