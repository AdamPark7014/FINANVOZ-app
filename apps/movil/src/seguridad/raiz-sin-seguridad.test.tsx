import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Raiz from '../../app/_layout';
import Inicio from '../../app/index';
import { mensajeBloqueoApagadoSinSeguridad } from '../pantallas/ajustes/textos';
import { crearSesionPrueba } from '../pantallas/onboarding/__pruebas__/sesion';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  fijarBloqueo,
  obtenerBloqueo,
  type Contexto,
} from '../servicios';

/**
 * La raíz real (`app/_layout.tsx`) con el bloqueo encendido en un teléfono que ya no tiene código ni biometría
 * (en iPhone, quitar el código apaga Face ID): sin `alSinSeguridad` la cortina nunca se quitaría.
 */
const mockAbiertas: { ctx: Contexto; cerrar: () => void }[] = [];
function mockAbrir() {
  const p = crearSesionPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  agregarEfectivo(p.ctx, 50_000);
  completarOnboarding(p.ctx);
  fijarBloqueo(p.ctx, { activo: true });
  mockAbiertas.push({ ctx: p.ctx, cerrar: p.cerrar });
  return { ctx: p.ctx, base: { db: p.ctx.db, cerrar: p.cerrar } };
}
jest.mock('../servicios/sesion', () => ({
  abrirSesion: jest.fn(() => mockAbrir()),
  borrarTodoApp: jest.fn(async () => {}),
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(async () => 0),
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'passcode_not_set' })),
}));
jest.mock('../observabilidad', () => ({ iniciarSentry: jest.fn() }));
jest.mock('../respaldo/expo', () => {
  const { crearRespaldoPrueba } = jest.requireActual('../pantallas/respaldo/__pruebas__/respaldo');
  const r = crearRespaldoPrueba();
  return { dependenciasRespaldoExpo: r.deps, archivosRespaldoExpo: r.archivos };
});
jest.mock('../pantallas/avisos/expo', () => ({ crearNotificacionesExpo: () => null }));

afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
});

it('con el bloqueo encendido y el teléfono sin código, la app entra, apaga el bloqueo y lo explica', async () => {
  renderRouter(
    { _layout: Raiz, index: Inicio, '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text> },
    { initialUrl: '/' },
  );
  const ctx = mockAbiertas[0]?.ctx;
  if (!ctx) throw new Error('no se abrió la sesión');
  await waitFor(() => expect(obtenerBloqueo(ctx).activo).toBe(false));
  expect(screen.queryByTestId('cortina-bloqueo')).toBeNull();
  expect(screen.getByTestId('pestana-hoy')).toBeTruthy();
  expect(screen.getByTestId('aviso')).toHaveTextContent(mensajeBloqueoApagadoSinSeguridad());
});
