import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import Hoy from '../../../app/(tabs)/hoy';
import Raiz from '../../../app/_layout';
import Ajustes from '../../../app/ajustes';
import AjustesIngreso from '../../../app/ajustes/ingreso';
import Inicio from '../../../app/index';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  configurarIngreso,
  obtenerAjustes,
  type Contexto,
} from '../../servicios';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { auditar } from '../__pruebas__/accesibilidad';
import {
  CONFIRMACION_INGRESO_VARIABLE,
  ETIQUETA_CAMBIAR_INGRESO,
  ETIQUETA_CONFIGURAR_INGRESO,
  fraseCuandoTePagan,
  lineaResumenIngreso,
  mensajeIngresoGuardado,
  RESUMEN_INGRESO_VARIABLE,
  RESUMEN_SIN_INGRESO,
} from './ingreso-textos';

/** Misma raíz real que `ajustes.test.tsx`: cada `abrirSesion` entrega una base nueva en memoria. */
const mockAbiertas: { ctx: Contexto; cerrar: () => void }[] = [];
let mockPreparar: ((ctx: Contexto) => void) | null = null;
function mockAbrir() {
  const p = crearSesionPrueba('2026-10-11');
  mockAbiertas.push({ ctx: p.ctx, cerrar: p.cerrar });
  mockPreparar?.(p.ctx);
  mockPreparar = null;
  return { ctx: p.ctx, base: { db: p.ctx.db, cerrar: p.cerrar } };
}
jest.mock('../../servicios/sesion', () => ({
  abrirSesion: jest.fn(() => mockAbrir()),
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
// Hoy real (navegación y aviso de regreso) con la pantalla reducida a su botón "Decir cada cuándo me pagan".
jest.mock('../principal', () => {
  const real = jest.requireActual('../principal');
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const { ETIQUETA_CONFIGURAR_INGRESO } = jest.requireActual('./ingreso-textos');
  return {
    ...real,
    PantallaHoy: ({ navegacion }: { navegacion: { alConfigurarIngreso: () => void } }) =>
      createElement(
        Pressable,
        {
          testID: 'boton-configurar-ingreso',
          accessibilityRole: 'button',
          accessibilityLabel: ETIQUETA_CONFIGURAR_INGRESO,
          onPress: navegacion.alConfigurarIngreso,
        },
        createElement(Text, null, ETIQUETA_CONFIGURAR_INGRESO),
      ),
  };
});

const RUTAS = {
  _layout: Raiz,
  index: Inicio,
  ajustes: Ajustes,
  'ajustes/ingreso': AjustesIngreso,
  '(tabs)/_layout': () => (
    <ProveedorAvisos sobrePestanas>
      <Slot />
    </ProveedorAvisos>
  ),
  '(tabs)/hoy': Hoy,
};

function base(ctx: Contexto) {
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  agregarEfectivo(ctx, 50_000);
  completarOnboarding(ctx);
}

function conQuincena(ctx: Contexto) {
  base(ctx);
  configurarIngreso(ctx, { monto: 1_300_000, regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' } });
}

function ctxInicial(): Contexto {
  const primera = mockAbiertas[0];
  if (!primera) throw new Error('no se abrió ninguna sesión');
  return primera.ctx;
}

const tocar = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const escribir = (testID: string, texto: string) => fireEvent.changeText(screen.getByTestId(testID), texto);

afterEach(() => {
  for (const s of mockAbiertas.splice(0)) s.cerrar();
  mockPreparar = null;
  jest.clearAllMocks();
});

describe('Ajustes › Ingreso y Colchón (02 §12)', () => {
  it('muestran el valor actual en palabras y pasan la auditoría de accesibilidad', () => {
    mockPreparar = conQuincena;
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(screen.getByTestId('ajustes-ingreso-resumen')).toHaveTextContent(
      lineaResumenIngreso(
        1_300_000,
        fraseCuandoTePagan({ tipo: 'quincenal_15_ultimo', ajuste: 'anterior' }),
        '2026-10-15',
      ),
    );
    expect(screen.getByTestId('ajustes-colchon-resumen')).toHaveTextContent(
      'Sin colchón: todo tu dinero libre cuenta para lo que puedes gastar.',
    );
    expect(screen.getByTestId('ajustes-cambiar-ingreso')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('ajustes-cambiar-ingreso')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_CAMBIAR_INGRESO,
    );
    expect(screen.getByTestId('ajustes-cambiar-colchon')).toHaveProp(
      'accessibilityLabel',
      'Apartar un colchón',
    );
    expect(screen.getByTestId('ajustes-ingreso-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('ajustes-colchon-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('ajustes-cambiar-ingreso')).toHaveProp(
      'accessibilityHint',
      'Abre el formulario para cambiar cuánto y cada cuándo te pagan',
    );
    expect(auditar(screen.toJSON() as never)).toEqual([]);
  });

  it('sin ingreso lo dice y ofrece decir cada cuándo te pagan', () => {
    mockPreparar = base;
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(screen.getByTestId('ajustes-ingreso-resumen')).toHaveTextContent(RESUMEN_SIN_INGRESO);
    expect(screen.getByTestId('ajustes-cambiar-ingreso')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_CONFIGURAR_INGRESO,
    );
  });

  it('cambiar el ingreso abre el formulario con lo guardado, guarda con el servicio y regresa con confirmación', () => {
    mockPreparar = conQuincena;
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();

    tocar('ajustes-cambiar-ingreso');
    expect(r.getPathname()).toBe('/ajustes/ingreso');
    expect(screen.getByTestId('editar-ingreso-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('editar-ingreso-frecuencia-quincena')).toHaveProp('accessibilityState', {
      selected: true,
      checked: true,
    });
    expect(screen.getByTestId('editar-ingreso-monto')).toHaveProp('value', '13,000');
    expect(auditar(screen.toJSON() as never)).toEqual([]);

    // Cada viernes: sin el día no se puede guardar.
    tocar('editar-ingreso-frecuencia-semanal');
    expect(screen.getByTestId('editar-ingreso-guardar')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: false,
    });
    tocar('editar-ingreso-dia-semana-5');
    tocar('editar-ingreso-guardar');

    expect(r.getPathname()).toBe('/ajustes');
    const { ingreso, ingresoVariable } = obtenerAjustes(ctx);
    expect(ingresoVariable).toBe(false);
    expect(ingreso).toMatchObject({
      monto: 1_300_000,
      regla: { tipo: 'semanal', dia_semana: 5, ajuste: 'anterior' },
    });
    expect(screen.getByTestId('ajustes-ingreso-confirmacion')).toHaveTextContent(
      mensajeIngresoGuardado(false, '2026-10-16'),
    );
    expect(screen.getByTestId('ajustes-ingreso-resumen')).toHaveTextContent(
      lineaResumenIngreso(
        1_300_000,
        fraseCuandoTePagan({ tipo: 'semanal', dia_semana: 5, ajuste: 'anterior' }),
        '2026-10-16',
      ),
    );
  });

  it('"Varía" deja el modo ingreso variable', () => {
    mockPreparar = conQuincena;
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();
    tocar('ajustes-cambiar-ingreso');
    tocar('editar-ingreso-frecuencia-varia');
    tocar('editar-ingreso-guardar');
    expect(obtenerAjustes(ctx)).toMatchObject({ ingreso: null, ingresoVariable: true });
    expect(screen.getByTestId('ajustes-ingreso-resumen')).toHaveTextContent(RESUMEN_INGRESO_VARIABLE);
    expect(screen.getByTestId('ajustes-ingreso-confirmacion')).toHaveTextContent(CONFIRMACION_INGRESO_VARIABLE);
  });

  it('Volver sale sin guardar', () => {
    mockPreparar = conQuincena;
    const r = renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();
    const antes = obtenerAjustes(ctx).ingreso;
    tocar('ajustes-cambiar-ingreso');
    tocar('editar-ingreso-frecuencia-varia');
    tocar('editar-ingreso-volver');
    expect(r.getPathname()).toBe('/ajustes');
    expect(obtenerAjustes(ctx).ingreso).toEqual(antes);
    expect(screen.queryByTestId('ajustes-ingreso-confirmacion')).toBeNull();
  });

  it('el colchón se cambia ahí mismo con el servicio de O7 y confirma', () => {
    mockPreparar = conQuincena;
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    const ctx = ctxInicial();

    tocar('ajustes-cambiar-colchon');
    // Sugerencia del 10 % de la quincena, igual que en O7.
    expect(screen.getByTestId('ajustes-colchon-monto')).toHaveProp('value', '1,300');
    expect(auditar(screen.toJSON() as never)).toEqual([]);

    // Vacío no guarda: para quitar el colchón hay que escribir 0.
    escribir('ajustes-colchon-monto', '');
    expect(screen.getByTestId('ajustes-colchon-guardar')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: false,
    });

    escribir('ajustes-colchon-monto', '2,000');
    tocar('ajustes-colchon-guardar');
    expect(obtenerAjustes(ctx).colchon).toBe(200_000);
    expect(screen.getByTestId('ajustes-colchon-mensaje')).toHaveTextContent(
      'Listo: tu colchón ahora es $2,000.',
    );
    expect(screen.getByTestId('ajustes-colchon-resumen')).toHaveTextContent(
      'Apartas $2,000 que no cuentan para lo que puedes gastar.',
    );

    tocar('ajustes-cambiar-colchon');
    escribir('ajustes-colchon-monto', '0');
    tocar('ajustes-colchon-guardar');
    expect(obtenerAjustes(ctx).colchon).toBe(0);
    expect(screen.getByTestId('ajustes-colchon-mensaje')).toHaveTextContent('Listo: ya no apartas colchón.');
  });
});

describe('Hoy → "Decir cada cuándo me pagan"', () => {
  it('lleva directo a Ajustes › Ingreso y, al guardar, regresa a Hoy con el aviso', () => {
    mockPreparar = base;
    const r = renderRouter(RUTAS, { initialUrl: '/hoy' });
    const ctx = ctxInicial();

    tocar('boton-configurar-ingreso');
    expect(r.getPathname()).toBe('/ajustes/ingreso');

    escribir('editar-ingreso-monto', '13,000');
    expect(screen.getByTestId('editar-ingreso-proximo-pago')).toHaveTextContent(/jue 15/);
    tocar('editar-ingreso-guardar');

    expect(r.getPathname()).toBe('/hoy');
    expect(obtenerAjustes(ctx).ingreso).toMatchObject({
      monto: 1_300_000,
      regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' },
    });
    expect(screen.getByTestId('aviso')).toHaveTextContent(mensajeIngresoGuardado(false, '2026-10-15'));
  });
});
