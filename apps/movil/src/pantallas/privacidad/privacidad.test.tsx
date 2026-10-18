import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking, Text } from 'react-native';
import Raiz from '../../../app/_layout';
import Ajustes from '../../../app/ajustes';
import AvisoPrivacidad from '../../../app/aviso-privacidad';
import Inicio from '../../../app/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import Bienvenida from '../../../app/onboarding/index';
import Privacidad from '../../../app/privacidad';
import Terminos from '../../../app/terminos';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  estadisticasActivas,
  VERSION_CONSENTIMIENTO,
  type Contexto,
} from '../../servicios';
import { abrirSesion, borrarTodoApp } from '../../servicios/sesion';
import { compartirArchivo } from '../ajustes/compartir';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { ACCESIBILIDAD_VOLVER, PISTA_VOLVER } from './textos';

/** La raíz real con la apertura nativa sustituida (igual que `ajustes.test.tsx`). */
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
jest.mock('../../observabilidad', () => ({ iniciarSentry: jest.fn() }));
jest.mock('../../respaldo/expo', () => {
  const { crearRespaldoPrueba } = jest.requireActual('../respaldo/__pruebas__/respaldo');
  const r = crearRespaldoPrueba();
  return { dependenciasRespaldoExpo: r.deps, archivosRespaldoExpo: r.archivos };
});
jest.mock('../ajustes/compartir', () => ({ compartirArchivo: jest.fn(async () => {}) }));

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  ajustes: Ajustes,
  privacidad: Privacidad,
  'aviso-privacidad': AvisoPrivacidad,
  terminos: Terminos,
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

beforeEach(() => {
  mockPreparar = conDatos;
});
afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
  jest.clearAllMocks();
});

describe('centro de privacidad (RF-PRI-03, 02 §12)', () => {
  it('se abre desde Ajustes', () => {
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    fireEvent.press(screen.getByTestId('ajustes-privacidad'));
    expect(r.getPathname()).toBe('/privacidad');
    expect(screen.getByText('Tu privacidad')).toBeTruthy();
    expect(screen.getByTestId('privacidad-volver')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('privacidad-volver')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_VOLVER);
    expect(screen.getByTestId('privacidad-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('dice qué se guarda, qué sale y a quién, y qué permisos usa', () => {
    renderRouter(RUTAS, { initialUrl: '/privacidad' });
    expect(screen.getByTestId('privacidad-guardado')).toHaveTextContent(/1 cuenta/);
    expect(screen.getByTestId('privacidad-guardado')).toHaveTextContent(/1 movimiento\b/);
    const sale = screen.getByTestId('privacidad-sale');
    for (const quien of [
      'Supabase',
      'inteligencia artificial',
      'Sentry',
      'PostHog',
      'RevenueCat',
      'fuera de México',
    ]) {
      expect(sale).toHaveTextContent(new RegExp(quien));
    }
    expect(sale).toHaveTextContent(/Nunca salen/);
    const permisos = screen.getByTestId('privacidad-permisos');
    for (const p of ['Micrófono', 'Acceso a notificaciones', 'Notificaciones', 'Huella o rostro']) {
      expect(permisos).toHaveTextContent(new RegExp(p));
    }
    expect(screen.getByTestId('privacidad-consentimiento')).toHaveTextContent(
      `Aceptaste el aviso de privacidad (versión ${VERSION_CONSENTIMIENTO}) el 11 oct 2026.`,
    );
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    fireEvent.press(screen.getByTestId('privacidad-ajustes-telefono'));
    expect(abrir).toHaveBeenCalled();
  });

  it('las estadísticas están apagadas y el interruptor las enciende y apaga', () => {
    renderRouter(RUTAS, { initialUrl: '/privacidad' });
    const ctx = ctxInicial();
    const interruptor = () => screen.getByTestId('privacidad-estadisticas');
    expect(interruptor()).toHaveProp('accessibilityState', { checked: false, disabled: false });
    fireEvent.press(interruptor());
    expect(estadisticasActivas(ctx)).toBe(true);
    expect(interruptor()).toHaveProp('accessibilityState', { checked: true, disabled: false });
    fireEvent.press(interruptor());
    expect(estadisticasActivas(ctx)).toBe(false);
  });

  it('lleva al aviso de privacidad', () => {
    const r = renderRouter(RUTAS, { initialUrl: '/privacidad' });
    fireEvent.press(screen.getByTestId('privacidad-aviso'));
    expect(r.getPathname()).toBe('/aviso-privacidad');
  });

  it('lleva a los términos de uso con el texto de 08 §1; Ajustes muestra el texto fijo en "Acerca de"', () => {
    const r = renderRouter(RUTAS, { initialUrl: '/privacidad' });
    fireEvent.press(screen.getByTestId('privacidad-terminos'));
    expect(r.getPathname()).toBe('/terminos');
    expect(
      screen.getByText(
        'Finanvoz no es una institución financiera ni asesor de inversiones. Las cifras son estimaciones con la información que registras y no garantizan resultados.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/no mueve dinero, no ofrece crédito/)).toBeTruthy();
    expect(screen.getByText(/gerencia@nexara\.com\.mx/)).toBeTruthy();

    r.unmount();
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(screen.getByTestId('ajustes-acerca')).toHaveTextContent(
      /Finanvoz no es una institución financiera ni asesor de inversiones/,
    );
  });

  it('exporta JSON y CSV con la hoja de compartir', async () => {
    renderRouter(RUTAS, { initialUrl: '/privacidad' });
    fireEvent.press(screen.getByTestId('privacidad-exportar-json'));
    await waitFor(() => expect(compartirArchivo).toHaveBeenCalledTimes(1));
    const json = llamada(0);
    expect(json).toMatchObject({ nombre: 'finanvoz-datos.json', tipoMime: 'application/json' });
    expect(JSON.parse(json.contenido)).toMatchObject({ formato: 'finanvoz-exportacion' });

    await waitFor(() => expect(screen.getByTestId('privacidad-exportar-csv')).not.toBeDisabled());
    fireEvent.press(screen.getByTestId('privacidad-exportar-csv'));
    await waitFor(() => expect(compartirArchivo).toHaveBeenCalledTimes(2));
    expect(llamada(1)).toMatchObject({ nombre: 'finanvoz-movimientos.csv', tipoMime: 'text/csv' });
  });

  it('borrar todo pide escribir BORRAR y después vuelve al onboarding con una base nueva', async () => {
    const r = renderRouter(RUTAS, { initialUrl: '/privacidad' });
    fireEvent.press(screen.getByTestId('privacidad-borrar-iniciar'));
    fireEvent.press(screen.getByTestId('privacidad-borrar-confirmar'));
    expect(borrarTodoApp).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('privacidad-borrar-palabra'), 'borrar');
    fireEvent.press(screen.getByTestId('privacidad-borrar-confirmar'));
    await waitFor(() => expect(r.getPathname()).toBe('/onboarding'));
    expect(borrarTodoApp).toHaveBeenCalledTimes(1);
    expect(jest.mocked(borrarTodoApp).mock.calls[0]?.[0]?.ctx).toBe(ctxInicial());
    expect(abrirSesion).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('onb-bienvenida')).toBeTruthy();
  });
});
