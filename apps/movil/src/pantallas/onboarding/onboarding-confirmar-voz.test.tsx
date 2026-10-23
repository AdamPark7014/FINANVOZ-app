import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import Cuentas from '../../../app/onboarding/cuentas';
import Ingreso from '../../../app/onboarding/ingreso';
import OnboardingLayout from '../../../app/onboarding/_layout';
import { aceptarConsentimiento, leerMontoDictado, obtenerHoy } from '../../servicios';
import { fijarConfirmarPorVoz } from '../../servicios/preferencias';
import { ProveedorDictado } from '../../voz';
import { crearMotorFalso } from '../../voz/__pruebas__/motor-falso';
import { crearSesionPrueba, type SesionPrueba } from './__pruebas__/sesion';
import { TEXTO_ESPERO_SI_PASO } from './textos';

// La voz del teléfono termina al instante: al terminar de decir la tarjeta, el micrófono escucha el «sí».
jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

/**
 * Onboarding por voz con la confirmación hablada (Ola 7 §4 y §7): al aparecer «Entendí», la voz la dice y, al
 * terminar, el micrófono escucha **un** turno sin tocar nada (`useConfirmacionPorVoz`). «Sí» guarda, «no, son 12
 * mil» corrige y vuelve a escuchar; un toque o el interruptor apagado no escuchan.
 */
const RUTAS = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/ingreso': Ingreso,
  'onboarding/cuentas': Cuentas,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

const D = 'onb-ingreso-decir';
let s: SesionPrueba;
let f: ReturnType<typeof crearMotorFalso>;
let ahora = 0;

beforeEach(() => {
  ahora = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  s = crearSesionPrueba('2026-10-11');
  aceptarConsentimiento(s.ctx, { datosFinancieros: true });
  f = crearMotorFalso();
});
afterEach(() => {
  s.cerrar();
  jest.restoreAllMocks();
});

function abrir(url: string) {
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <s.Envoltura>
      <ProveedorDictado motor={f.motor} leerMonto={leerMontoDictado}>
        {children}
      </ProveedorDictado>
    </s.Envoltura>
  );
  return renderRouter(RUTAS, { initialUrl: url, wrapper: Envoltura });
}

/** Toca el micrófono de «Dímelo», dice la frase y suelta. */
async function decir(texto: string) {
  ahora += 10_000;
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  const mic = () => screen.getByTestId(`${D}-dictar`);
  await act(async () => {
    fireEvent(mic(), 'pressIn');
  });
  fireEvent(mic(), 'pressOut');
  await f.emitir({ tipo: 'resultado', texto, final: true });
  await act(async () => {});
}

/** Contesta hablando al turno que el micrófono abrió solo (sin tocar). */
async function contestar(texto: string) {
  await f.emitir({ tipo: 'resultado', texto, final: true });
  await act(async () => {});
}

const escuchas = () => f.motor.iniciar.mock.calls.length;

describe('O3 · confirmar «Entendí» hablando, sin tocar el micrófono', () => {
  it('la voz dice la tarjeta, el micrófono escucha solo y «sí» guarda y pasa a O4', async () => {
    const r = abrir('/onboarding/ingreso');
    await decir('gano 13 mil cada quincena');
    expect(screen.getByTestId(`${D}-entendi`)).toBeTruthy();
    // El dictado de la frase fue la primera escucha; la segunda la abre la tarjeta al terminar de hablar.
    await waitFor(() => expect(escuchas()).toBe(2));
    expect(screen.getByTestId(`${D}-escuchando`)).toHaveTextContent(TEXTO_ESPERO_SI_PASO);
    await contestar('sí');
    expect(r.getPathname()).toBe('/onboarding/cuentas');
    expect(obtenerHoy(s.ctx).proximoIngreso?.concepto).toBe('quincena');
  });

  it('«no, son 12 mil» corrige la cifra, se queda la quincena y vuelve a escuchar', async () => {
    const r = abrir('/onboarding/ingreso');
    await decir('gano 13 mil cada quincena');
    await waitFor(() => expect(escuchas()).toBe(2));
    await contestar('no, son 12 mil');
    expect(screen.getByTestId(`${D}-entendi-monto`)).toHaveTextContent(/12,000/);
    expect(screen.getByTestId(`${D}-entendi-fila-frecuencia`)).toHaveTextContent(/Cada quincena/);
    await waitFor(() => expect(escuchas()).toBe(3));
    await contestar('sale');
    expect(r.getPathname()).toBe('/onboarding/cuentas');
  });

  it('un toque deja de escuchar: lo que llegue después no guarda nada', async () => {
    const r = abrir('/onboarding/ingreso');
    await decir('gano 13 mil cada quincena');
    await waitFor(() => expect(escuchas()).toBe(2));
    await act(async () => {
      fireEvent(screen.getByTestId(D), 'touchStart');
    });
    await contestar('sí');
    expect(r.getPathname()).toBe('/onboarding/ingreso');
    expect(screen.getByTestId(`${D}-entendi`)).toBeTruthy();
    expect(obtenerHoy(s.ctx).proximoIngreso).toBeNull();
  });

  it('con «Confirmar por voz» apagado en Ajustes › Voz, la tarjeta espera el toque', async () => {
    fijarConfirmarPorVoz(s.ctx, false);
    const r = abrir('/onboarding/ingreso');
    await decir('gano 13 mil cada quincena');
    expect(screen.getByTestId(`${D}-entendi`)).toBeTruthy();
    await act(async () => {});
    expect(escuchas()).toBe(1);
    expect(screen.queryByTestId(`${D}-escuchando`)).toBeNull();
    expect(r.getPathname()).toBe('/onboarding/ingreso');
  });
});
