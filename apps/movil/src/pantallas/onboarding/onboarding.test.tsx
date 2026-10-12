import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import AvisoPrivacidad from '../../../app/aviso-privacidad';
import Inicio from '../../../app/index';
import Captura from '../../../app/onboarding/captura';
import Colchon from '../../../app/onboarding/colchon';
import Consentimiento from '../../../app/onboarding/consentimiento';
import Cuentas from '../../../app/onboarding/cuentas';
import Ingreso from '../../../app/onboarding/ingreso';
import Bienvenida from '../../../app/onboarding/index';
import OnboardingLayout from '../../../app/onboarding/_layout';
import PagosFijos from '../../../app/onboarding/pagos-fijos';
import TarjetaCredito from '../../../app/onboarding/tarjeta';
import {
  aceptarConsentimiento,
  exportarJson,
  listarCuentas,
  obtenerAjustes,
  obtenerConsentimiento,
  obtenerHoy,
  onboardingCompletado,
} from '../../servicios';
import { crearSesionPrueba, type SesionPrueba } from './__pruebas__/sesion';

/** Las rutas reales del onboarding sobre una raíz mínima; las pestañas son de otra pantalla y aquí se simulan. */
const RUTAS = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: Inicio,
  'aviso-privacidad': AvisoPrivacidad,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/index': Bienvenida,
  'onboarding/consentimiento': Consentimiento,
  'onboarding/ingreso': Ingreso,
  'onboarding/cuentas': Cuentas,
  'onboarding/tarjeta': TarjetaCredito,
  'onboarding/pagos-fijos': PagosFijos,
  'onboarding/captura': Captura,
  'onboarding/colchon': Colchon,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

let s: SesionPrueba;
beforeEach(() => {
  s = crearSesionPrueba('2026-10-11');
});
afterEach(() => s.cerrar());

function abrir(url: string) {
  return renderRouter(RUTAS, { initialUrl: url, wrapper: s.Envoltura });
}

/** Filas de cada tabla: si no cambian, no se escribió nada. */
function conteoTablas(): Record<string, number> {
  const { tablas } = JSON.parse(exportarJson(s.ctx)) as { tablas: Record<string, unknown[]> };
  return Object.fromEntries(Object.entries(tablas).map(([t, filas]) => [t, filas.length]));
}

const escribir = (testID: string, texto: string) => fireEvent.changeText(screen.getByTestId(testID), texto);
const tocar = (testID: string) => fireEvent.press(screen.getByTestId(testID));

describe('onboarding', () => {
  it('sin consentimiento, "/" lleva a la bienvenida', () => {
    const r = abrir('/');
    expect(r.getPathname()).toBe('/onboarding');
    expect(screen.getByTestId('onb-bienvenida')).toBeTruthy();
  });

  it('CA-M2-05 · no se escribe nada antes de aceptar; al aceptar queda la evidencia', () => {
    const r = abrir('/onboarding');
    const antes = conteoTablas();
    tocar('onb-empezar');
    expect(r.getPathname()).toBe('/onboarding/consentimiento');

    // La casilla obligatoria viene sin marcar y el botón no hace nada hasta marcarla.
    expect(screen.getByTestId('onb-casilla-datos')).toHaveProp('accessibilityState', { checked: false });
    expect(screen.getByTestId('onb-casilla-estadisticas')).toHaveProp('accessibilityState', {
      checked: false,
    });
    tocar('onb-aceptar');
    expect(r.getPathname()).toBe('/onboarding/consentimiento');
    expect(obtenerConsentimiento(s.ctx)).toBeNull();
    expect(conteoTablas()).toEqual(antes);

    tocar('onb-casilla-datos');
    tocar('onb-aceptar');
    expect(r.getPathname()).toBe('/onboarding/ingreso');
    expect(obtenerConsentimiento(s.ctx)).toMatchObject({
      datos_financieros: true,
      estadisticas: false,
      medio: 'onboarding',
      fecha: '2026-10-11',
    });
  });

  it('el aviso completo se abre desde O2', () => {
    const r = abrir('/onboarding/consentimiento');
    tocar('onb-aviso-completo');
    expect(r.getPathname()).toBe('/aviso-privacidad');
    expect(screen.getByText('Tus derechos')).toBeTruthy();
  });

  describe('tarjeta de crédito (02 §3.1)', () => {
    beforeEach(() => {
      aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    });

    function llenarTarjeta() {
      escribir('tarjeta-nombre', 'Oro');
      escribir('tarjeta-ultimos4', '8812');
      escribir('tarjeta-corte', '28');
      tocar('tarjeta-modo-limite-dias');
      escribir('tarjeta-limite-pago', '20');
      escribir('tarjeta-limite-credito', '30,000');
      tocar('tarjeta-completa-si');
    }

    it('CA-M2-12 · con meses que ya tenía y "No sé": no resta los meses del saldo y Hoy avisa', () => {
      const r = abrir('/onboarding/cuentas');
      tocar('onb-agregar-tarjeta');
      expect(r.getPathname()).toBe('/onboarding/tarjeta');
      llenarTarjeta();
      escribir('tarjeta-saldo', '8,000');
      tocar('tarjeta-msi-si');
      escribir('tarjeta-msi-mensualidad-0', '500');
      escribir('tarjeta-msi-restantes-0', '6');

      // Sin responder "¿El saldo ya los incluye?" no se guarda.
      tocar('tarjeta-guardar');
      expect(screen.getByTestId('error-formulario')).toHaveTextContent(/ya incluye esos meses/);
      expect(listarCuentas(s.ctx).debes).toHaveLength(0);

      tocar('tarjeta-incluye-no_se');
      expect(screen.getByTestId('tarjeta-no-se-ayuda')).toBeTruthy();
      tocar('tarjeta-guardar');
      expect(r.getPathname()).toBe('/onboarding/cuentas');

      const [tarjeta] = listarCuentas(s.ctx).debes;
      expect(tarjeta).toMatchObject({ tipo: 'tarjeta', nombre: 'Oro', saldo: 800_000, meses: 300_000 });
      expect(obtenerHoy(s.ctx).avisos.map((a) => a.texto)).toEqual([
        'Puede que esté contando dos veces tus meses de la Oro. Compáralo con tu próximo estado de cuenta.',
      ]);
      expect(screen.getByTestId('onb-cuentas-lista')).toHaveTextContent(/Oro/);
    });

    it('sin saldo no se crea la tarjeta; "Agregar después" no guarda nada', () => {
      const r = abrir('/onboarding/cuentas');
      tocar('onb-agregar-tarjeta');
      llenarTarjeta();
      tocar('tarjeta-guardar');
      expect(screen.getByTestId('error-formulario')).toHaveTextContent(/cuánto debes hoy/);
      tocar('tarjeta-despues');
      expect(r.getPathname()).toBe('/onboarding/cuentas');
      expect(listarCuentas(s.ctx).debes).toHaveLength(0);
    });
  });

  it('CA-M2-01 · recorrido completo O1–O7 termina en Hoy', () => {
    const r = abrir('/');
    tocar('onb-empezar');
    tocar('onb-casilla-datos');
    tocar('onb-aceptar');

    // O3: quincena por omisión; se ve el próximo pago (15 oct 2026 es jueves).
    escribir('onb-ingreso-monto', '13,000');
    expect(screen.getByTestId('onb-proximo-pago')).toHaveTextContent(/jue 15/);
    tocar('onb-ingreso-continuar');
    expect(r.getPathname()).toBe('/onboarding/cuentas');

    // O4: efectivo y una cuenta de débito.
    escribir('onb-efectivo', '600');
    tocar('onb-agregar-cuenta');
    escribir('onb-cuenta-nombre', 'BBVA');
    escribir('onb-cuenta-saldo', '4,200');
    tocar('onb-cuenta-agregar');
    tocar('onb-cuentas-continuar');
    expect(r.getPathname()).toBe('/onboarding/pagos-fijos');

    // O5: renta con chip sugerido.
    tocar('onb-pago-renta');
    escribir('onb-pago-monto', '4,500');
    escribir('onb-pago-dia', '1');
    tocar('onb-pago-agregar');
    expect(screen.getByTestId('onb-pagos-lista')).toHaveTextContent(/Renta/);
    tocar('onb-pagos-continuar');

    // O6: sin módulo nativo, "No disponible en este teléfono".
    expect(screen.getByTestId('onb-captura-pronto')).toHaveTextContent(/No disponible en este teléfono/);
    tocar('onb-captura-continuar');

    // O7: sugerencia del 10 % del ingreso ya escrita.
    expect(screen.getByTestId('onb-colchon-monto')).toHaveProp('value', '1,300');
    tocar('onb-ver-mi-dia');

    expect(r.getPathname()).toBe('/hoy');
    expect(screen.getByTestId('pestana-hoy')).toBeTruthy();
    expect(onboardingCompletado(s.ctx)).toBe(true);
    expect(obtenerAjustes(s.ctx).colchon).toBe(130_000);
    expect(listarCuentas(s.ctx).tienes.map((c) => [c.nombre, c.saldo])).toEqual(
      expect.arrayContaining([
        ['Efectivo', 60_000],
        ['BBVA', 420_000],
      ]),
    );
  });

  it('con el onboarding completo, "/" lleva a Hoy', () => {
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    const r = abrir('/onboarding/colchon');
    tocar('onb-colchon-saltar');
    expect(r.getPathname()).toBe('/hoy');
    expect(obtenerAjustes(s.ctx).colchon).toBe(0);
    r.unmount();
    expect(abrir('/').getPathname()).toBe('/hoy');
  });
});
