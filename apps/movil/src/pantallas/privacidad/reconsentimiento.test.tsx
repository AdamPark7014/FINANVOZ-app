import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
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
import { AVISO_SIMPLIFICADO, etiquetaAvisoSimplificadoOnboarding } from '../onboarding/aviso';
import { crearSesionPrueba, type SesionPrueba } from '../onboarding/__pruebas__/sesion';
import {
  etiquetaIntroReconsentimiento,
  PISTA_CASILLA_DATOS_FINANCIEROS,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_RECONSENT_ACEPTAR,
  PISTA_RECONSENT_BORRAR,
  PISTA_RECONSENT_SOLO_LECTURA,
  TEXTO_BORRAR_ADVERTENCIA,
  TITULO_AVISO_PRIVACIDAD,
} from './textos';

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

  it('borrar todo pide escribir BORRAR antes de llamar al control de la app', () => {
    abrir('/');
    tocar('reconsent-borrar');
    // Un toque solo abre la confirmación: nada se borra todavía.
    expect(s.control.borrarTodo).not.toHaveBeenCalled();
    expect(screen.getByText(TEXTO_BORRAR_ADVERTENCIA)).toBeTruthy();
    expect(screen.getByTestId('reconsent-borrar-confirmar')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: false,
    });
    tocar('reconsent-borrar-confirmar');
    expect(s.control.borrarTodo).not.toHaveBeenCalled();
    // Cancelar cierra la confirmación sin borrar.
    tocar('reconsent-borrar-cancelar');
    expect(screen.queryByTestId('reconsent-borrar-confirmar')).toBeNull();
    tocar('reconsent-borrar');
    fireEvent.changeText(screen.getByTestId('reconsent-borrar-palabra'), 'borrar');
    tocar('reconsent-borrar-confirmar');
    expect(s.control.borrarTodo).toHaveBeenCalledTimes(1);
  });

  it('VoiceOver: «Leer el aviso completo» queda fuera del resumen agrupado (alcanzable en iOS)', () => {
    abrir('/');
    const resumen = screen.getByTestId('reconsent-aviso-simplificado');
    expect(resumen).toHaveProp('accessible', true);
    expect(within(resumen).queryByTestId('reconsent-aviso-completo')).toBeNull();
    expect(screen.getByTestId('reconsent-aviso-completo')).toHaveProp('accessibilityRole', 'button');
  });

  it('TalkBack: aviso resumido, casillas y pistas en los botones', () => {
    abrir('/');
    expect(screen.getByTestId('reconsent-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('reconsent-intro')).toHaveProp(
      'accessibilityLabel',
      etiquetaIntroReconsentimiento(VERSION_CONSENTIMIENTO),
    );
    expect(screen.getByTestId('reconsent-aviso-simplificado')).toHaveProp(
      'accessibilityLabel',
      etiquetaAvisoSimplificadoOnboarding(TITULO_AVISO_PRIVACIDAD, AVISO_SIMPLIFICADO),
    );
    expect(screen.getByTestId('reconsent-aviso-completo')).toHaveProp(
      'accessibilityHint',
      PISTA_LEER_AVISO_COMPLETO,
    );
    expect(screen.getByTestId('reconsent-casilla-datos')).toHaveProp('accessibilityState', {
      checked: false,
    });
    expect(screen.getByTestId('reconsent-aceptar')).toHaveProp(
      'accessibilityHint',
      PISTA_CASILLA_DATOS_FINANCIEROS,
    );
    tocar('reconsent-casilla-datos');
    expect(screen.getByTestId('reconsent-aceptar')).toHaveProp('accessibilityHint', PISTA_RECONSENT_ACEPTAR);
    expect(screen.getByTestId('reconsent-solo-lectura')).toHaveProp(
      'accessibilityHint',
      PISTA_RECONSENT_SOLO_LECTURA,
    );
    expect(screen.getByTestId('reconsent-borrar')).toHaveProp('accessibilityHint', PISTA_RECONSENT_BORRAR);
  });
});
