import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import Inicio from '../../../app/index';
import ReconsentimientoRuta from '../../../app/reconsentimiento';
import {
  aceptarConsentimiento,
  agregarEfectivo,
  completarOnboarding,
  enSoloLectura,
  obtenerConsentimiento,
  VERSION_CONSENTIMIENTO,
} from '../../servicios';
import { crearSesionPrueba, type SesionPrueba } from '../onboarding/__pruebas__/sesion';

const RUTAS = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: Inicio,
  reconsentimiento: ReconsentimientoRuta,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

let s: SesionPrueba;

beforeEach(() => {
  s = crearSesionPrueba('2026-10-11');
  s.control.borrarTodo.mockClear();
  aceptarConsentimiento(s.ctx, { datosFinancieros: true, version: '2026-10-m2' });
  agregarEfectivo(s.ctx, 50_000);
  completarOnboarding(s.ctx);
});
afterEach(() => s.cerrar());

function abrir(url = '/') {
  return renderRouter(RUTAS, { initialUrl: url, wrapper: s.Envoltura });
}

const tocar = (testID: string) => fireEvent.press(screen.getByTestId(testID));

describe('reconsentimiento (pendiente 31)', () => {
  it('"/" redirige al aviso nuevo cuando la versión aceptada es anterior', () => {
    const r = abrir('/');
    expect(r.getPathname()).toBe('/reconsentimiento');
    expect(screen.getByTestId('reconsentimiento')).toBeTruthy();
  });

  it('aceptar actualiza la evidencia y abre Hoy', () => {
    const r = abrir('/');
    tocar('reconsent-casilla-datos');
    tocar('reconsent-aceptar');
    expect(r.getPathname()).toBe('/hoy');
    expect(obtenerConsentimiento(s.ctx)?.version).toBe(VERSION_CONSENTIMIENTO);
    expect(enSoloLectura(s.ctx)).toBe(false);
  });

  it('continuar sin aceptar deja solo lectura y abre Hoy', () => {
    const r = abrir('/');
    tocar('reconsent-solo-lectura');
    expect(r.getPathname()).toBe('/hoy');
    expect(enSoloLectura(s.ctx)).toBe(true);
    expect(obtenerConsentimiento(s.ctx)?.version).toBe('2026-10-m2');
  });

  it('borrar todo llama al control de la app', () => {
    abrir('/');
    tocar('reconsent-borrar');
    expect(s.control.borrarTodo).toHaveBeenCalledTimes(1);
  });
});
