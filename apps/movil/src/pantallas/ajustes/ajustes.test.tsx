import { useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Raiz from '../../../app/_layout';
import Ajustes from '../../../app/ajustes';
import Ayuda from '../../../app/ayuda';
import AvisoPrivacidad from '../../../app/aviso-privacidad';
import Inicio from '../../../app/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import Bienvenida from '../../../app/onboarding/index';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  obtenerBloqueo,
  obtenerPreferenciasAvisos,
  type Contexto,
} from '../../servicios';
import { abrirSesion } from '../../servicios/sesion';
import { notificacionesEnMemoria } from '../avisos/notificaciones';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { auditar } from '../__pruebas__/accesibilidad';
import { PISTA_VOLVER } from './textos';

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

// Avisos locales en memoria en lugar de `expo-notifications` (los toques se simulan con `tocar`/`abrirDesde`).
let mockNotificaciones: ReturnType<typeof notificacionesEnMemoria> | null = null;
jest.mock('../avisos/expo', () => ({ crearNotificacionesExpo: () => mockNotificaciones }));

function Detalle({ testID }: { testID: string }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Text testID={testID}>{String(id)}</Text>;
}

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  ajustes: Ajustes,
  ayuda: Ayuda,
  'aviso-privacidad': AvisoPrivacidad,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/index': Bienvenida,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
  'persona/[id]': () => <Detalle testID="detalle-persona" />,
  'tandas/[id]': () => <Detalle testID="detalle-tanda" />,
  'tarjetas/[id]': () => <Detalle testID="detalle-tarjeta" />,
  respaldo: () => <Text testID="pantalla-respaldo">Respaldo</Text>,
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
  mockNotificaciones = null;
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

  it('Ajustes pasa la auditoría de accesibilidad y abre la Ayuda (CA-M13-04)', () => {
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('ajustes-abrir-ayuda'));
    expect(r.getPathname()).toBe('/ayuda');
    expect(screen.getByText('¿Cómo calculas mi «hoy puedes»?')).toBeTruthy();
    expect(screen.getByTestId('ayuda-escribir')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ayuda-volver'));
    expect(r.getPathname()).toBe('/ajustes');
  });

  it('los avisos de tanda, compromiso sin cubrir e ingreso que no llegó se apagan desde Ajustes › Avisos', () => {
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();
    expect(obtenerPreferenciasAvisos(ctx)).toMatchObject({ tanda: true, compromiso: true, ingreso: true });
    fireEvent.press(screen.getByTestId('ajustes-aviso-tanda'));
    fireEvent.press(screen.getByTestId('ajustes-aviso-compromiso'));
    fireEvent.press(screen.getByTestId('ajustes-aviso-ingreso'));
    expect(obtenerPreferenciasAvisos(ctx)).toMatchObject({ tanda: false, compromiso: false, ingreso: false });
  });

  // Exportar y borrar todo viven en el centro de privacidad (`pantallas/privacidad/privacidad.test.tsx`).
});

describe('tocar un aviso (pendiente 33)', () => {
  it('con la app abierta o en segundo plano abre la pantalla del aviso', async () => {
    mockPreparar = conDatos;
    const n = notificacionesEnMemoria();
    mockNotificaciones = n;
    const r = renderRouter(RUTAS, { initialUrl: '/' });
    expect(r.getPathname()).toBe('/hoy');

    act(() => n.tocar('cobro:contraparte:per-1'));
    await waitFor(() => expect(screen.getByTestId('detalle-persona')).toHaveTextContent('contraparte:per-1'));

    act(() => n.tocar('tarjeta:limite:tc-1:2026-11-09', '/tarjetas/tc-1'));
    await waitFor(() => expect(r.getPathname()).toBe('/tarjetas/tc-1'));

    act(() => n.tocar('respaldo:2026-10-25'));
    await waitFor(() => expect(r.getPathname()).toBe('/respaldo'));

    // Riesgo, compromisos, ingresos y avisos desconocidos llevan a Hoy.
    act(() => n.tocar('riesgo:2026-10-30'));
    await waitFor(() => expect(r.getPathname()).toBe('/hoy'));
  });

  it('al abrir la app en frío desde el aviso, espera a que la raíz decida y abre su pantalla', async () => {
    mockPreparar = conDatos;
    const n = notificacionesEnMemoria();
    n.abrirDesde('tanda:tan-1:2026-10-16');
    mockNotificaciones = n;
    const r = renderRouter(RUTAS, { initialUrl: '/' });
    await waitFor(() => expect(r.getPathname()).toBe('/tandas/tan-1'));
    expect(screen.getByTestId('detalle-tanda')).toHaveTextContent('tan-1');
    // El mismo toque no se vuelve a atender.
    expect(await n.respuestas.ultima()).toBeNull();
  });

  it('sin onboarding completo no se salta la bienvenida', async () => {
    const n = notificacionesEnMemoria();
    n.abrirDesde('cobro:per-1');
    mockNotificaciones = n;
    const r = renderRouter(RUTAS, { initialUrl: '/' });
    await waitFor(() => expect(screen.getByTestId('onb-bienvenida')).toBeTruthy());
    await act(async () => {});
    expect(r.getPathname()).toBe('/onboarding');
  });
});
