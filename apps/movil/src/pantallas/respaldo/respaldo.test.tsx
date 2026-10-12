import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Raiz from '../../../app/_layout';
import Inicio from '../../../app/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import Bienvenida from '../../../app/onboarding/index';
import Privacidad from '../../../app/privacidad';
import RestaurarRespaldo from '../../../app/restaurar';
import { archivosRespaldoExpo, dependenciasRespaldoExpo } from '../../respaldo/expo';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  fijarContrasenaRespaldo,
  generarRespaldo,
  MENSAJE_NO_ABRE,
  tieneContrasenaRespaldo,
  type Contexto,
} from '../../servicios';
import { borrarTodoApp, restaurarSesion } from '../../servicios/sesion';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { AVISO_CONTRASENA } from './FormularioContrasena';
import { crearRespaldoPrueba } from './__pruebas__/respaldo';

const mockAbiertas: { ctx: Contexto; cerrar: () => void }[] = [];
let mockPreparar: ((ctx: Contexto) => void) | null = null;
jest.mock('../../servicios/sesion', () => {
  const { crearSesionPrueba: crear } = jest.requireActual('../onboarding/__pruebas__/sesion');
  const servicios = jest.requireActual('../../servicios');
  return {
    abrirSesion: jest.fn(() => {
      const p = crear('2026-10-11');
      mockAbiertas.push({ ctx: p.ctx, cerrar: p.cerrar });
      mockPreparar?.(p.ctx);
      mockPreparar = null;
      return { ctx: p.ctx, base: { db: p.ctx.db, cerrar: p.cerrar } };
    }),
    borrarTodoApp: jest.fn(async () => {}),
    // Como en la app: importa el respaldo ensayado en la base nueva de las dependencias (aquí, de Node).
    restaurarSesion: jest.fn((listo: unknown) => {
      const { dependenciasRespaldoExpo: deps } = jest.requireMock('../../respaldo/expo');
      const base = servicios.restaurarRespaldo(deps, listo);
      const ctx = servicios.crearContexto({
        db: base.db,
        reloj: servicios.relojFijo('2026-10-11'),
        generarId: servicios.crearGeneradorSecuencial(),
      });
      mockAbiertas.push({ ctx, cerrar: () => base.cerrar() });
      return { ctx, base };
    }),
  };
});
jest.mock('../../respaldo/expo', () => {
  const { crearRespaldoPrueba: crear } = jest.requireActual('./__pruebas__/respaldo');
  const r = crear();
  return { dependenciasRespaldoExpo: r.deps, archivosRespaldoExpo: r.archivos };
});
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
jest.mock('../../observabilidad', () => ({ iniciarSentry: jest.fn() }));

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  privacidad: Privacidad,
  restaurar: RestaurarRespaldo,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/index': Bienvenida,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

const CONTRASENA = 'mi frase de respaldo';
/** scrypt con n = 2^17 tarda alrededor de un segundo en jest. */
const LENTO = { timeout: 15_000 };
const deps = dependenciasRespaldoExpo as ReturnType<typeof crearRespaldoPrueba>['deps'];
const archivos = archivosRespaldoExpo as ReturnType<typeof crearRespaldoPrueba>['archivos'];

function conDatos(ctx: Contexto) {
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  agregarEfectivo(ctx, 50_000);
  completarOnboarding(ctx);
}

/** Un `.cartera` hecho en "otro teléfono" con un movimiento. */
async function respaldoDeOtroTelefono(): Promise<Uint8Array> {
  const otro = crearSesionPrueba('2026-10-11');
  conDatos(otro.ctx);
  const suyo = crearRespaldoPrueba().deps;
  await fijarContrasenaRespaldo(suyo, CONTRASENA, CONTRASENA);
  const archivo = await generarRespaldo(suyo, otro.ctx);
  otro.cerrar();
  return archivo;
}

afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
  deps.almacen.valores.clear();
  jest.clearAllMocks();
});

describe('respaldo cifrado (M9, 02 §19)', () => {
  it('crea la contraseña con el aviso, exporta el .cartera por la hoja de compartir y deja cambiarla', async () => {
    mockPreparar = conDatos;
    renderRouter(RUTAS, { initialUrl: '/privacidad' });
    expect(screen.queryByTestId('privacidad-respaldo-exportar')).toBeNull();
    fireEvent.press(screen.getByTestId('privacidad-respaldo-crear'));
    expect(screen.getByTestId('respaldo-aviso-contrasena')).toHaveTextContent(AVISO_CONTRASENA);

    fireEvent.changeText(screen.getByTestId('respaldo-contrasena'), 'corta');
    fireEvent.changeText(screen.getByTestId('respaldo-contrasena-confirmar'), 'corta');
    fireEvent.press(screen.getByTestId('respaldo-contrasena-guardar'));
    expect(screen.getByText('Usa al menos 10 caracteres.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('respaldo-contrasena'), CONTRASENA);
    fireEvent.changeText(screen.getByTestId('respaldo-contrasena-confirmar'), `${CONTRASENA}!`);
    fireEvent.press(screen.getByTestId('respaldo-contrasena-guardar'));
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('respaldo-contrasena-confirmar'), CONTRASENA);
    fireEvent.press(screen.getByTestId('respaldo-contrasena-guardar'));
    await waitFor(() => expect(screen.getByTestId('privacidad-respaldo-exportar')).toBeTruthy(), LENTO);
    expect(tieneContrasenaRespaldo(deps)).toBe(true);
    // La contraseña no se guarda: solo la llave derivada y su sal.
    expect([...deps.almacen.valores.values()].join()).not.toContain(CONTRASENA);

    fireEvent.press(screen.getByTestId('privacidad-respaldo-exportar'));
    await waitFor(() => expect(archivos.compartir).toHaveBeenCalledTimes(1), LENTO);
    const [nombre, bytes] = archivos.compartir.mock.calls[0] as [string, Uint8Array];
    expect(nombre).toBe('finanvoz-2026-10-11.cartera');
    expect(Buffer.from(bytes.subarray(0, 8)).toString('ascii')).toBe('CARTERA1');

    await waitFor(() => expect(screen.getByTestId('privacidad-respaldo-exportar')).not.toBeDisabled());
    fireEvent.press(screen.getByTestId('privacidad-respaldo-cambiar'));
    expect(screen.getByText(/se siguen abriendo con la contraseña anterior/)).toBeTruthy();
  });

  it('un teléfono nuevo restaura desde la bienvenida: mismo mensaje para contraseña equivocada, después Hoy', async () => {
    const archivo = await respaldoDeOtroTelefono();
    const r = renderRouter(RUTAS, { initialUrl: '/' });
    await waitFor(() => expect(r.getPathname()).toBe('/onboarding'));
    fireEvent.press(screen.getByTestId('onb-restaurar'));
    expect(r.getPathname()).toBe('/restaurar');

    archivos.elegir.mockResolvedValueOnce(archivo);
    fireEvent.press(screen.getByTestId('restaurar-elegir'));
    await waitFor(() => expect(screen.getByTestId('restaurar-contrasena')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('restaurar-contrasena'), 'no es esta contraseña');
    fireEvent.press(screen.getByTestId('restaurar-abrir'));
    await waitFor(
      () => expect(screen.getByTestId('restaurar-error')).toHaveTextContent(MENSAJE_NO_ABRE),
      LENTO,
    );

    fireEvent.changeText(screen.getByTestId('restaurar-contrasena'), CONTRASENA);
    fireEvent.press(screen.getByTestId('restaurar-abrir'));
    await waitFor(
      () =>
        expect(screen.getByTestId('restaurar-resumen')).toHaveTextContent(
          'Tu respaldo del 11 oct 2026 trae 1 movimiento.',
        ),
      LENTO,
    );
    // Teléfono sin datos: no hay nada que reemplazar.
    expect(screen.queryByTestId('restaurar-reemplaza')).toBeNull();

    fireEvent.press(screen.getByTestId('restaurar-confirmar'));
    await waitFor(() => expect(r.getPathname()).toBe('/hoy'), LENTO);
    expect(borrarTodoApp).toHaveBeenCalledTimes(1);
    expect(restaurarSesion).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('aviso')).toHaveTextContent('Listo: recuperé 1 movimiento');
    // El respaldo automático seguirá con la misma contraseña en este teléfono.
    expect(tieneContrasenaRespaldo(deps)).toBe(true);
  });

  it('desde el centro de privacidad avisa que se reemplaza lo que hay en el teléfono', async () => {
    const archivo = await respaldoDeOtroTelefono();
    mockPreparar = conDatos;
    const r = renderRouter(RUTAS, { initialUrl: '/privacidad' });
    fireEvent.press(screen.getByTestId('privacidad-respaldo-restaurar'));
    expect(r.getPathname()).toBe('/restaurar');
    archivos.elegir.mockResolvedValueOnce(archivo);
    fireEvent.press(screen.getByTestId('restaurar-elegir'));
    await waitFor(() => expect(screen.getByTestId('restaurar-contrasena')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('restaurar-contrasena'), CONTRASENA);
    fireEvent.press(screen.getByTestId('restaurar-abrir'));
    await waitFor(() => expect(screen.getByTestId('restaurar-reemplaza')).toBeTruthy(), LENTO);
    expect(borrarTodoApp).not.toHaveBeenCalled();
  });

  it('un archivo que no es respaldo se rechaza sin pedir contraseña', async () => {
    const r = renderRouter(RUTAS, { initialUrl: '/restaurar' });
    expect(r.getPathname()).toBe('/restaurar');
    archivos.elegir.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    fireEvent.press(screen.getByTestId('restaurar-elegir'));
    await waitFor(() => expect(screen.getByTestId('restaurar-contrasena')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('restaurar-contrasena'), 'lo que sea');
    fireEvent.press(screen.getByTestId('restaurar-abrir'));
    await waitFor(() =>
      expect(screen.getByTestId('restaurar-error')).toHaveTextContent(
        'Ese archivo no es un respaldo de Finanvoz.',
      ),
    );
  });
});
