import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Raiz from '../../../app/_layout';
import Ajustes from '../../../app/ajustes';
import Inicio from '../../../app/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import Bienvenida from '../../../app/onboarding/index';
import Respaldo from '../../../app/respaldo';
import RestaurarRespaldo from '../../../app/restaurar';
import { dependenciasRespaldoExpo } from '../../respaldo/expo';
import { programarRespaldoAutomatico } from '../../respaldo/programar';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  confirmarCodigoRespaldo,
  fijarContrasenaRespaldo,
  obtenerRespaldoNube,
  respaldarEnNube,
  tieneContrasenaRespaldo,
  type Contexto,
} from '../../servicios';
import type { servidorRespaldoFalso } from '../../servicios/__pruebas__/respaldo-nube';
import { borrarTodoApp, restaurarSesion } from '../../servicios/sesion';
import type { TiendaEnMemoria } from '../../suscripciones/memoria';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
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
    restaurarSesion: jest.fn((listo: { fecha: string }) => {
      const { dependenciasRespaldoExpo: deps } = jest.requireMock('../../respaldo/expo');
      const base = servicios.restaurarRespaldo(deps, listo);
      const ctx = servicios.crearContexto({
        db: base.db,
        reloj: servicios.relojFijo('2026-10-11'),
        generarId: servicios.crearGeneradorSecuencial(),
      });
      servicios.registrarRespaldoRestaurado(ctx, listo.fecha);
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
jest.mock('../../respaldo/programar', () => ({ programarRespaldoAutomatico: jest.fn(async () => {}) }));
// Nube de respaldo falsa (Auth con código y bucket con el contrato del proxy) para el teléfono de la prueba.
jest.mock('../../nube/expo', () => {
  const { servidorRespaldoFalso: crear } = jest.requireActual('../../servicios/__pruebas__/respaldo-nube');
  const estado: {
    servidor: ReturnType<typeof crear>;
    telefono: ReturnType<ReturnType<typeof crear>['telefono']>;
  } = { servidor: crear(), telefono: null as never };
  estado.telefono = estado.servidor.telefono();
  return {
    mockEstado: estado,
    mockReiniciar: () => {
      estado.servidor = crear();
      estado.telefono = estado.servidor.telefono();
    },
    crearNivelNubeExpo: () => ({
      cliente: { interpretar: async () => ({ tipo: 'sin_red' }) },
      conectividad: { enLinea: async () => true, alReconectar: () => () => {} },
      usuarioId: async () => estado.telefono.sesion().usuarioId,
    }),
    crearPuertoEvidenciaExpo: () => null,
    crearNubeRespaldoExpo: () => estado.telefono,
    // Sin gastos compartidos en esta prueba: la raíz no registra su tarea ni sincroniza.
    crearClienteCompartidoExpo: () => null,
  };
});
jest.mock('../../suscripciones/expo', () => {
  const { crearComprasEnMemoria } = jest.requireActual('../../suscripciones/memoria');
  const tienda = crearComprasEnMemoria();
  return { mockTienda: tienda, crearComprasExpo: () => tienda };
});
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
jest.mock('../../observabilidad', () => ({ iniciarSentry: jest.fn() }));

type Servidor = ReturnType<typeof servidorRespaldoFalso>;
const nubeMock = jest.requireMock('../../nube/expo') as {
  mockEstado: { servidor: Servidor; telefono: ReturnType<Servidor['telefono']> };
  mockReiniciar: () => void;
};
const tienda = (jest.requireMock('../../suscripciones/expo') as { mockTienda: TiendaEnMemoria }).mockTienda;

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  ajustes: Ajustes,
  respaldo: Respaldo,
  restaurar: RestaurarRespaldo,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/index': Bienvenida,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

const CORREO = 'ana@correo.mx';
const CONTRASENA = 'mi frase de respaldo';
/** scrypt con n = 2^17 tarda alrededor de un segundo en jest. */
const LENTO = { timeout: 15_000 };
const deps = dependenciasRespaldoExpo as ReturnType<typeof crearRespaldoPrueba>['deps'];

function conDatos(ctx: Contexto) {
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  agregarEfectivo(ctx, 50_000);
  completarOnboarding(ctx);
}

function ctxActual(): Contexto {
  const ultimo = mockAbiertas[mockAbiertas.length - 1];
  if (!ultimo) throw new Error('sin sesión');
  return ultimo.ctx;
}

async function entrarConCorreo() {
  await waitFor(() => expect(screen.getByTestId('respaldo-correo')).toBeTruthy());
  fireEvent.changeText(screen.getByTestId('respaldo-correo'), CORREO);
  fireEvent.press(screen.getByTestId('respaldo-pedir-codigo'));
  await waitFor(() => expect(screen.getByTestId('respaldo-codigo')).toBeTruthy());
  fireEvent.changeText(screen.getByTestId('respaldo-codigo'), '000000');
  fireEvent.press(screen.getByTestId('respaldo-confirmar-codigo'));
  await waitFor(() =>
    expect(screen.getByTestId('respaldo-nube-error')).toHaveTextContent(
      'El código no es correcto o ya venció. Pide otro.',
    ),
  );
  fireEvent.changeText(screen.getByTestId('respaldo-codigo'), '123456');
  fireEvent.press(screen.getByTestId('respaldo-confirmar-codigo'));
}

beforeEach(() => nubeMock.mockReiniciar());
afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
  deps.almacen.valores.clear();
  jest.clearAllMocks();
});

describe('Ajustes → Respaldo en la nube (M9, 02 §19)', () => {
  it('correo → código → contraseña, respaldar ahora, automático con Wi-Fi y borrar la cuenta de punta a punta', async () => {
    mockPreparar = conDatos;
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(screen.getByTestId('ajustes-respaldo')).toHaveTextContent(
      /Todavía no tienes respaldos en la nube/,
    );
    fireEvent.press(screen.getByTestId('ajustes-abrir-respaldo'));
    expect(r.getPathname()).toBe('/respaldo');
    expect(screen.getByTestId('respaldo-ultimo')).toHaveTextContent(
      'Todavía no tienes respaldos en la nube.',
    );
    // CA-M9-06 en pantalla: el reloj fijo terminó el onboarding el 21 sep; el 11 oct ya van 20 días sin respaldo.
    expect(screen.getByTestId('respaldo-pendiente')).toHaveTextContent(
      'Llevas más de 2 semanas sin respaldo.',
    );

    await entrarConCorreo();
    const telefono = nubeMock.mockEstado.telefono;
    // Vincular: el mismo usuario anónimo queda con correo (conserva plan y cupo).
    await waitFor(() => expect(screen.getByTestId('respaldo-contrasena')).toBeTruthy());
    expect(telefono.sesion().correo).toBe(CORREO);

    fireEvent.changeText(screen.getByTestId('respaldo-contrasena'), CONTRASENA);
    fireEvent.changeText(screen.getByTestId('respaldo-contrasena-confirmar'), CONTRASENA);
    fireEvent.press(screen.getByTestId('respaldo-contrasena-guardar'));
    await waitFor(() => expect(screen.getByTestId('respaldo-ahora')).toBeTruthy(), LENTO);
    expect(screen.getByTestId('respaldo-correo-actual')).toHaveTextContent(`Respaldas con ${CORREO}.`);
    // La tarjeta del archivo también ya ve la contraseña.
    expect(screen.getByTestId('privacidad-respaldo-exportar')).toBeTruthy();

    fireEvent.press(screen.getByTestId('respaldo-ahora'));
    await waitFor(
      () =>
        expect(screen.getByTestId('respaldo-mensaje')).toHaveTextContent(
          'Listo: tu respaldo está en la nube.',
        ),
      LENTO,
    );
    expect(screen.getByTestId('respaldo-ultimo')).toHaveTextContent('Último respaldo: hoy');
    expect(screen.queryByTestId('respaldo-pendiente')).toBeNull();
    const usuario = telefono.sesion().usuarioId;
    expect(nubeMock.mockEstado.servidor.archivosDe(usuario)).toHaveLength(1);

    // Automático semanal: se registra la tarea; "Solo con Wi-Fi" aparece encendido.
    expect(screen.queryByTestId('respaldo-solo-wifi')).toBeNull();
    fireEvent.press(screen.getByTestId('respaldo-automatico'));
    await waitFor(() => expect(programarRespaldoAutomatico).toHaveBeenLastCalledWith(true));
    expect(screen.getByTestId('respaldo-solo-wifi')).toBeTruthy();
    expect(obtenerRespaldoNube(ctxActual())).toMatchObject({ automatico: true, soloWifi: true });
    fireEvent.press(screen.getByTestId('respaldo-solo-wifi'));
    expect(obtenerRespaldoNube(ctxActual()).soloWifi).toBe(false);

    // Borrar la cuenta: avisa, borra archivos y usuario, olvida la sesión, apaga el automático y Plus pasa al
    // usuario anónimo nuevo (pendiente 58).
    fireEvent.press(screen.getByTestId('respaldo-borrar-cuenta'));
    expect(screen.getByTestId('respaldo-borrar-aviso')).toHaveTextContent(/Se borran todos tus respaldos/);
    fireEvent.press(screen.getByTestId('respaldo-borrar-confirmar'));
    await waitFor(() =>
      expect(screen.getByTestId('respaldo-mensaje')).toHaveTextContent(
        'Listo: borré tu cuenta de respaldo y tus respaldos de la nube.',
      ),
    );
    expect(nubeMock.mockEstado.servidor.archivosDe(usuario)).toEqual([]);
    expect(nubeMock.mockEstado.servidor.existeCuenta(CORREO)).toBe(false);
    expect(telefono.sesion().usuarioId).not.toBe(usuario);
    expect(tienda.usuario).toBe(telefono.sesion().usuarioId);
    expect(screen.getByTestId('respaldo-correo')).toBeTruthy();
    expect(obtenerRespaldoNube(ctxActual())).toMatchObject({ automatico: false, ultimo: null });
    await waitFor(() => expect(programarRespaldoAutomatico).toHaveBeenLastCalledWith(false));
  }, 60_000);

  it('si la nube responde sin_correo, pide otra vez el correo y el código', async () => {
    mockPreparar = conDatos;
    renderRouter(RUTAS, { initialUrl: '/respaldo' });
    await entrarConCorreo();
    await waitFor(() => expect(screen.getByTestId('respaldo-contrasena')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('respaldo-contrasena'), CONTRASENA);
    fireEvent.changeText(screen.getByTestId('respaldo-contrasena-confirmar'), CONTRASENA);
    fireEvent.press(screen.getByTestId('respaldo-contrasena-guardar'));
    await waitFor(() => expect(screen.getByTestId('respaldo-ahora')).toBeTruthy(), LENTO);

    // El refresh de la sesión de correo dejó de servir: la app quedó con un anónimo.
    nubeMock.mockEstado.telefono.caducarSesion();
    fireEvent.press(screen.getByTestId('respaldo-ahora'));
    await waitFor(
      () =>
        expect(screen.getByTestId('respaldo-pide-correo')).toHaveTextContent(
          'Tu sesión de respaldo venció. Vuelve a entrar con tu correo y el código para seguir respaldando.',
        ),
      LENTO,
    );
    expect(screen.getByTestId('respaldo-mensaje')).toHaveTextContent(
      'Vuelve a entrar con tu correo para seguir respaldando.',
    );
    expect(obtenerRespaldoNube(ctxActual()).pedirCorreo).toBe(true);

    await entrarConCorreo();
    await waitFor(() => expect(screen.getByTestId('respaldo-ahora')).toBeTruthy());
    expect(obtenerRespaldoNube(ctxActual()).pedirCorreo).toBe(false);
    // Entró a la cuenta original: las compras siguen a ese usuario.
    await waitFor(() => expect(tienda.usuario).toBe(nubeMock.mockEstado.telefono.sesion().usuarioId));
  }, 60_000);
});

describe('restaurar desde la nube en un teléfono nuevo (M9, 02 §19, CA-M9-05 app)', () => {
  it('¿Vienes de otro teléfono? → nube → correo y código → contraseña → Listo: recuperé… → Hoy', async () => {
    // Otro teléfono respalda en la misma nube con su contraseña.
    const servidor = nubeMock.mockEstado.servidor;
    const otro = crearSesionPrueba('2026-10-11');
    conDatos(otro.ctx);
    const suyo = crearRespaldoPrueba().deps;
    await fijarContrasenaRespaldo(suyo, CONTRASENA, CONTRASENA);
    const nubeVieja = servidor.telefono();
    expect((await nubeVieja.cuenta.pedirCodigo(CORREO)).ok).toBe(true);
    expect((await confirmarCodigoRespaldo(nubeVieja.cuenta, otro.ctx, CORREO, '123456', 'vincular')).ok).toBe(
      true,
    );
    expect((await respaldarEnNube({ cifrado: suyo, respaldos: nubeVieja.respaldos }, otro.ctx)).ok).toBe(
      true,
    );
    otro.cerrar();

    const r = renderRouter(RUTAS, { initialUrl: '/' });
    await waitFor(() => expect(r.getPathname()).toBe('/onboarding'));
    fireEvent.press(screen.getByTestId('onb-restaurar'));
    expect(r.getPathname()).toBe('/restaurar');
    fireEvent.press(screen.getByTestId('restaurar-nube'));

    // Un correo sin cuenta: lo dice sin crear nada.
    fireEvent.changeText(screen.getByTestId('respaldo-correo'), 'nadie@correo.mx');
    fireEvent.press(screen.getByTestId('respaldo-pedir-codigo'));
    await waitFor(() =>
      expect(screen.getByTestId('respaldo-nube-error')).toHaveTextContent(
        'No encontré una cuenta de respaldo con ese correo.',
      ),
    );
    await entrarConCorreo();
    await waitFor(() =>
      expect(screen.getByTestId('restaurar-encontre')).toHaveTextContent(
        'Encontré tu respaldo más reciente. Escribe su contraseña.',
      ),
    );
    // Entró al usuario original: las compras de Plus lo siguen.
    await waitFor(() => expect(tienda.usuario).toBe(nubeVieja.sesion().usuarioId));

    fireEvent.changeText(screen.getByTestId('restaurar-contrasena'), CONTRASENA);
    fireEvent.press(screen.getByTestId('restaurar-abrir'));
    await waitFor(
      () =>
        expect(screen.getByTestId('restaurar-resumen')).toHaveTextContent(
          'Tu respaldo del 11 oct 2026 trae 1 movimiento.',
        ),
      LENTO,
    );
    fireEvent.press(screen.getByTestId('restaurar-confirmar'));
    await waitFor(() => expect(r.getPathname()).toBe('/hoy'), LENTO);
    // Restaurar conserva la sesión de correo (el automático sigue sin volver a entrar).
    expect(borrarTodoApp).toHaveBeenCalledWith(expect.anything(), { conservarSesionNube: true });
    expect(restaurarSesion).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('aviso')).toHaveTextContent('Listo: recuperé 1 movimiento');
    expect(tieneContrasenaRespaldo(deps)).toBe(true);
    expect(obtenerRespaldoNube(ctxActual())).toMatchObject({ ultimo: '2026-10-11', pedirCorreo: false });
  }, 60_000);
});
