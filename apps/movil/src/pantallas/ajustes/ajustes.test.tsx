import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Raiz from '../../../app/_layout';
import Ajustes from '../../../app/ajustes';
import AvisoPrivacidad from '../../../app/aviso-privacidad';
import Inicio from '../../../app/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import Bienvenida from '../../../app/onboarding/index';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  obtenerBloqueo,
  type Contexto,
} from '../../servicios';
import { abrirSesion, borrarTodoApp } from '../../servicios/sesion';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { compartirArchivo } from './compartir';

/**
 * La raíz real (`app/_layout.tsx`) con la apertura nativa sustituida: cada `abrirSesion` entrega una base nueva
 * en memoria (como tras "Borrar todo") y `borrarTodoApp` solo se registra.
 */
const mockAbiertas: { ctx: Contexto; cerrar: () => void }[] = [];
function mockAbrir() {
  const p = crearSesionPrueba('2026-10-11');
  mockAbiertas.push({ ctx: p.ctx, cerrar: p.cerrar });
  return { ctx: p.ctx, base: { db: p.ctx.db, cerrar: p.cerrar } };
}
let mockPreparar: ((ctx: Contexto) => void) | null = null;
jest.mock('../../servicios/sesion', () => ({
  abrirSesion: jest.fn(() => {
    const s = mockAbrir();
    mockPreparar?.(s.ctx);
    mockPreparar = null;
    return s;
  }),
  borrarTodoApp: jest.fn(async () => {}),
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
// El SDK de Sentry deja temporizadores vivos en jest; sin DSN `iniciarSentry` no hace nada de todos modos.
jest.mock('../../observabilidad', () => ({ iniciarSentry: jest.fn() }));
jest.mock('./compartir', () => ({ compartirArchivo: jest.fn(async () => {}) }));

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  ajustes: Ajustes,
  'aviso-privacidad': AvisoPrivacidad,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/index': Bienvenida,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

function conDatos(ctx: Contexto) {
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  agregarEfectivo(ctx, 50_000);
  completarOnboarding(ctx);
}

function ctxInicial(): Contexto {
  const primera = mockAbiertas[0];
  if (!primera) throw new Error('no se abrió ninguna sesión');
  return primera.ctx;
}

function llamada(n: number) {
  const args = jest.mocked(compartirArchivo).mock.calls[n];
  if (!args) throw new Error(`compartirArchivo no se llamó ${n + 1} veces`);
  return args[0];
}

afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
  jest.clearAllMocks();
});

describe('raíz', () => {
  it('con onboarding completo entra a Hoy', () => {
    mockPreparar = conDatos;
    const r = renderRouter(RUTAS, { initialUrl: '/' });
    expect(r.getPathname()).toBe('/hoy');
  });

  it('si la base no abre, muestra un error amable y deja reintentar', () => {
    jest.mocked(abrirSesion).mockImplementationOnce(() => {
      throw new Error('no abre');
    });
    renderRouter(RUTAS, { initialUrl: '/' });
    expect(screen.getByText('No pude abrir tus datos')).toBeTruthy();
    fireEvent.press(screen.getByText('Intentar de nuevo'));
    expect(screen.getByTestId('onb-bienvenida')).toBeTruthy();
  });
});

describe('ajustes', () => {
  beforeEach(() => {
    mockPreparar = conDatos;
  });

  it('bloqueo y ocultar en multitarea se guardan', () => {
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();
    fireEvent.press(screen.getByTestId('ajustes-multitarea'));
    expect(obtenerBloqueo(ctx)).toMatchObject({ activo: false, ocultarEnMultitarea: true });
    expect(screen.getByTestId('ajustes-multitarea')).toHaveProp('accessibilityState', {
      checked: true,
      disabled: false,
    });
    fireEvent.press(screen.getByTestId('ajustes-bloqueo'));
    expect(obtenerBloqueo(ctx).activo).toBe(true);
  });

  it('exporta JSON y CSV con la hoja de compartir', async () => {
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    fireEvent.press(screen.getByTestId('ajustes-exportar-json'));
    await waitFor(() => expect(compartirArchivo).toHaveBeenCalledTimes(1));
    const json = llamada(0);
    expect(json).toMatchObject({ nombre: 'finanvoz-datos.json', tipoMime: 'application/json' });
    expect(JSON.parse(json.contenido)).toMatchObject({ formato: 'finanvoz-exportacion' });

    await waitFor(() => expect(screen.getByTestId('ajustes-exportar-csv')).not.toBeDisabled());
    fireEvent.press(screen.getByTestId('ajustes-exportar-csv'));
    await waitFor(() => expect(compartirArchivo).toHaveBeenCalledTimes(2));
    expect(llamada(1)).toMatchObject({
      nombre: 'finanvoz-movimientos.csv',
      tipoMime: 'text/csv',
    });
  });

  it('borrar todo pide escribir BORRAR y después vuelve al onboarding con una base nueva', async () => {
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    fireEvent.press(screen.getByTestId('ajustes-borrar-iniciar'));
    fireEvent.press(screen.getByTestId('ajustes-borrar-confirmar'));
    expect(borrarTodoApp).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('ajustes-borrar-palabra'), 'borrar');
    fireEvent.press(screen.getByTestId('ajustes-borrar-confirmar'));
    await waitFor(() => expect(r.getPathname()).toBe('/onboarding'));
    expect(borrarTodoApp).toHaveBeenCalledTimes(1);
    expect(jest.mocked(borrarTodoApp).mock.calls[0]?.[0]?.ctx).toBe(ctxInicial());
    expect(abrirSesion).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('onb-bienvenida')).toBeTruthy();
  });
});
