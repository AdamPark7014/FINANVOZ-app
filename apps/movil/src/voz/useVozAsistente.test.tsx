import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { aceptarConsentimiento, fijarVozRespuesta } from '../servicios';
import { fijarAjustesVoz } from '../servicios/preferencias';
import { ProveedorSesion } from '../sesion/ProveedorSesion';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';
import type { TurnoAsistente } from '../asistente/tipos';
import {
  callarVoz,
  configuracionVoz,
  configurarVoz,
  CONFIG_VOZ_INICIAL,
  decirTurno,
  hablar,
} from './respuesta';
import { CORTAR_VOZ_AL_TOCAR, olvidarReducirMovimiento, useVozAsistente } from './useVozAsistente';

jest.mock('./respuesta', () => ({
  ...jest.requireActual<typeof import('./respuesta')>('./respuesta'),
  decirTurno: jest.fn(async () => 'dicha'),
  hablar: jest.fn(async () => 'dicha'),
}));

let prueba: ReturnType<typeof abrirPruebaPantalla>;

beforeEach(() => {
  prueba = abrirPruebaPantalla();
  aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
  configurarVoz(CONFIG_VOZ_INICIAL);
  olvidarReducirMovimiento();
  jest.mocked(decirTurno).mockClear();
  jest.mocked(hablar).mockClear();
});

afterEach(() => {
  prueba.cerrar();
  jest.restoreAllMocks();
});

function montar() {
  const envoltura = ({ children }: { children: ReactNode }) => (
    <ProveedorSesion ctx={prueba.ctx} nube={null}>
      {children}
    </ProveedorSesion>
  );
  return renderHook(() => useVozAsistente(), { wrapper: envoltura });
}

const REGISTRO: TurnoAsistente = {
  id: 'r',
  de: 'asistente',
  clase: 'registro',
  texto: 'Registré Coca $25 · Antojos · Efectivo.',
};

describe('useVozAsistente (lo que usa la pantalla del asistente)', () => {
  it('dice los turnos con la voz y la velocidad de Ajustes › Voz', async () => {
    fijarAjustesVoz(prueba.ctx, { voz: 'es-us-x-esd', velocidad: 'rapida' });
    const { result } = montar();
    expect(configuracionVoz()).toEqual({ voz: 'es-us-x-esd', velocidad: 'rapida', enSilencio: false });
    expect(result.current.activa).toBe(true);
    await act(async () => {
      await expect(result.current.decirTurno(REGISTRO, { hoyPuedes: 18_900 })).resolves.toBe('dicha');
    });
    expect(decirTurno).toHaveBeenCalledWith(
      REGISTRO,
      { hoyPuedes: 18_900 },
      { voz: 'es-us-x-esd', velocidad: 'rapida', enSilencio: false },
    );
  });

  it('con «Contestarte en voz» apagado no dice los turnos, pero sí lo que la persona pide', async () => {
    fijarVozRespuesta(prueba.ctx, false);
    const { result } = montar();
    expect(result.current.activa).toBe(false);
    await act(async () => {
      await expect(result.current.decirTurno(REGISTRO)).resolves.toBe('omitida');
    });
    expect(decirTurno).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.decir('Listo.', { forzar: true });
    });
    expect(hablar).toHaveBeenCalledWith(
      'Listo.',
      expect.objectContaining({ forzar: true, velocidad: 'normal' }),
    );
  });

  it('cortar al tocar y saber si está hablando', async () => {
    const { result } = montar();
    await act(async () => {});
    expect(result.current.cortarAlTocar).toBe(CORTAR_VOZ_AL_TOCAR);
    expect(CORTAR_VOZ_AL_TOCAR.onTouchStart).toBe(callarVoz);
    expect(result.current.callar).toBe(callarVoz);
    expect(result.current.hablando).toBe(false);
  });

  it('«Reducir movimiento»: no anima hasta saber que está apagado', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = montar();
    expect(result.current.animar).toBe(false);
    await act(async () => {});
    expect(result.current.animar).toBe(true);
  });

  it('«Reducir movimiento» encendido: nunca anima', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = montar();
    await act(async () => {});
    expect(result.current.animar).toBe(false);
  });
});
