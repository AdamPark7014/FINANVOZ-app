import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
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
import { abrirSesion } from '../../servicios/sesion';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';

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
jest.mock('../../respaldo/expo', () => {
  const { crearRespaldoPrueba } = jest.requireActual('../respaldo/__pruebas__/respaldo');
  const r = crearRespaldoPrueba();
  return { dependenciasRespaldoExpo: r.deps, archivosRespaldoExpo: r.archivos };
});

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

  // Exportar y borrar todo viven en el centro de privacidad (`pantallas/privacidad/privacidad.test.tsx`).
});
