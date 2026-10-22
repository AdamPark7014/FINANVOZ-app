import { Stack } from 'expo-router';
import { interpretarMontoCampo as interpretarMonto } from '@cartera/nlu';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
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
import {
  TIP_CAPTURA_AHORA_NO,
  TIP_COLCHON_SIN_POR_AHORA,
  TIP_CONSENTIMIENTO,
  TIP_CUENTAS_MINIMO,
  TIP_INGRESO_SALTAR,
  TIP_PAGOS_SALTAR,
} from './tips';
import { PISTA_ONBOARDING_RESTAURAR } from '../respaldo/textos';
import {
  ContextoDictadoCampos,
  etiquetaHablada,
  type DictadoCampos,
  type PropsBotonDictarCampo,
} from '../../ui';
import { BotonDictarCampo } from '../../voz/BotonDictarCampo';
import { crearMotorFalso } from '../principal/__pruebas__/arnes';
import {
  etiquetaProgresoOnboarding,
  etiquetaProximoPagoOnboarding,
  PISTA_AGREGAR_TARJETA_ONB,
  PISTA_COMPLETAR_INGRESO,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_MARCAR_CASILLA_DATOS,
  PISTA_ONB_CONTINUAR,
  PISTA_ONB_EMPEZAR,
  PISTA_PAGOS_CONTINUAR,
  PISTA_PAGOS_SALTAR,
  PISTA_TARJETA_DESPUES_ONB,
  PISTA_TARJETA_GUARDAR_ONB,
  TITULO_BIENVENIDA,
} from './textos';
import { AVISO_SIMPLIFICADO, etiquetaAvisoSimplificadoOnboarding } from './aviso';
import { TITULO_AVISO_SIMPLIFICADO } from './textos';

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
    expect(screen.getByTestId('onb-titulo-paso')).toHaveProp('accessibilityLabel', TITULO_BIENVENIDA);
    expect(screen.getByTestId('onb-progreso').props.accessibilityLabel).toBe(etiquetaProgresoOnboarding(1));
    expect(screen.getByTestId('onb-empezar')).toHaveProp('accessibilityHint', PISTA_ONB_EMPEZAR);
    expect(screen.getByTestId('onb-restaurar')).toHaveProp('accessibilityHint', PISTA_ONBOARDING_RESTAURAR);
  });

  it('CA-M2-05 · no se escribe nada antes de aceptar; al aceptar queda la evidencia', () => {
    const r = abrir('/onboarding');
    const antes = conteoTablas();
    tocar('onb-empezar');
    expect(r.getPathname()).toBe('/onboarding/consentimiento');
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_CONSENTIMIENTO,
    );
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveProp(
      'accessibilityLabel',
      `Consejo: ${TIP_CONSENTIMIENTO}`,
    );
    expect(screen.getByTestId('onb-aviso-simplificado')).toHaveProp(
      'accessibilityLabel',
      etiquetaAvisoSimplificadoOnboarding(TITULO_AVISO_SIMPLIFICADO, AVISO_SIMPLIFICADO),
    );

    // La casilla obligatoria viene sin marcar y el botón no hace nada hasta marcarla.
    expect(screen.getByTestId('onb-casilla-datos')).toHaveProp('accessibilityState', { checked: false });
    expect(screen.getByTestId('onb-casilla-estadisticas')).toHaveProp('accessibilityState', {
      checked: false,
    });
    expect(screen.getByTestId('onb-aceptar')).toHaveProp('accessibilityHint', PISTA_MARCAR_CASILLA_DATOS);
    tocar('onb-aceptar');
    expect(r.getPathname()).toBe('/onboarding/consentimiento');
    expect(obtenerConsentimiento(s.ctx)).toBeNull();
    expect(conteoTablas()).toEqual(antes);

    tocar('onb-casilla-datos');
    expect(screen.getByTestId('onb-aceptar')).toHaveProp('accessibilityHint', PISTA_ONB_CONTINUAR);
    tocar('onb-aceptar');
    expect(r.getPathname()).toBe('/onboarding/ingreso');
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_INGRESO_SALTAR,
    );
    expect(screen.getByTestId('onb-ingreso-continuar')).toHaveProp(
      'accessibilityHint',
      PISTA_COMPLETAR_INGRESO,
    );
    expect(obtenerConsentimiento(s.ctx)).toMatchObject({
      datos_financieros: true,
      estadisticas: false,
      medio: 'onboarding',
      fecha: '2026-10-11',
    });
  });

  it('el aviso completo se abre desde O2', () => {
    const r = abrir('/onboarding/consentimiento');
    expect(screen.getByTestId('onb-aviso-completo')).toHaveProp(
      'accessibilityHint',
      PISTA_LEER_AVISO_COMPLETO,
    );
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
      expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
        TIP_CUENTAS_MINIMO,
      );
      expect(screen.getByTestId('onb-agregar-tarjeta')).toHaveProp(
        'accessibilityHint',
        PISTA_AGREGAR_TARJETA_ONB,
      );
      tocar('onb-agregar-tarjeta');
      expect(r.getPathname()).toBe('/onboarding/tarjeta');
      expect(screen.getByTestId('tarjeta-guardar')).toHaveProp(
        'accessibilityHint',
        PISTA_TARJETA_GUARDAR_ONB,
      );
      expect(screen.getByTestId('tarjeta-despues')).toHaveProp(
        'accessibilityHint',
        PISTA_TARJETA_DESPUES_ONB,
      );
      llenarTarjeta();
      escribir('tarjeta-saldo', '8,000');
      tocar('tarjeta-msi-si');
      escribir('tarjeta-msi-mensualidad-0', '500');
      escribir('tarjeta-msi-restantes-0', '6');

      // Sin responder "¿El saldo ya los incluye?" no se guarda.
      tocar('tarjeta-guardar');
      expect(screen.getByTestId('error-formulario')).toHaveTextContent(/ya incluye esos meses/);
      expect(screen.getByTestId('error-formulario')).toHaveProp(
        'accessibilityLabel',
        expect.stringMatching(/ya incluye esos meses/),
      );
      expect(screen.getByTestId('error-formulario')).toHaveProp('importantForAccessibility', 'yes');
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
      expect(screen.getByTestId('tarjeta-guardar')).toHaveProp(
        'accessibilityHint',
        PISTA_TARJETA_GUARDAR_ONB,
      );
      expect(screen.getByTestId('tarjeta-despues')).toHaveProp(
        'accessibilityHint',
        PISTA_TARJETA_DESPUES_ONB,
      );
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
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_INGRESO_SALTAR,
    );
    escribir('onb-ingreso-monto', '13,000');
    expect(screen.getByTestId('onb-proximo-pago')).toHaveTextContent(/jue 15/);
    expect(screen.getByTestId('onb-proximo-pago').props.accessibilityLabel).toBe(
      etiquetaHablada(etiquetaProximoPagoOnboarding('jue 15')),
    );
    tocar('onb-ingreso-continuar');
    expect(r.getPathname()).toBe('/onboarding/cuentas');

    // O4: efectivo y una cuenta de débito.
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_CUENTAS_MINIMO,
    );
    escribir('onb-efectivo', '600');
    tocar('onb-agregar-cuenta');
    escribir('onb-cuenta-nombre', 'BBVA');
    escribir('onb-cuenta-saldo', '4,200');
    tocar('onb-cuenta-agregar');
    tocar('onb-cuentas-continuar');
    expect(r.getPathname()).toBe('/onboarding/pagos-fijos');

    // O5: renta con chip sugerido.
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_PAGOS_SALTAR,
    );
    tocar('onb-pago-renta');
    escribir('onb-pago-monto', '4,500');
    escribir('onb-pago-dia', '1');
    tocar('onb-pago-agregar');
    expect(screen.getByTestId('onb-pagos-lista')).toHaveTextContent(/Renta/);
    tocar('onb-pagos-continuar');

    // O6: sin módulo nativo, "No disponible en este teléfono".
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_CAPTURA_AHORA_NO,
    );
    expect(screen.getByTestId('onb-captura-pronto')).toHaveTextContent(/No disponible en este teléfono/);
    tocar('onb-captura-continuar');

    // O7: sugerencia del 10 % del ingreso ya escrita.
    expect(screen.getByTestId('onb-tip', { includeHiddenElements: false })).toHaveTextContent(
      TIP_COLCHON_SIN_POR_AHORA,
    );
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

  it('O5 · pagos fijos: pista TalkBack y fila agregada en palabras', () => {
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    abrir('/onboarding/pagos-fijos');
    expect(screen.getByTestId('onb-pagos-continuar')).toHaveProp('accessibilityHint', PISTA_PAGOS_SALTAR);
    tocar('onb-pago-renta');
    escribir('onb-pago-monto', '4,500');
    escribir('onb-pago-dia', '1');
    tocar('onb-pago-agregar');
    expect(screen.getByTestId('onb-pagos-continuar')).toHaveProp('accessibilityHint', PISTA_PAGOS_CONTINUAR);
    expect(screen.getByTestId(/^onb-pago-agregado-/).props.accessibilityLabel).toMatch(/pesos/);
  });

  it('O5 · «Otro» cada semana con fin por pagos restantes: fila con detalle, total mensual y quitar', () => {
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    abrir('/onboarding/pagos-fijos');
    tocar('onb-pago-otro');
    escribir('onb-pago-nombre', 'Clases de inglés');
    tocar('onb-pago-frecuencia-semanal');
    tocar('onb-pago-dia-semana-2');
    escribir('onb-pago-monto', '300');
    tocar('onb-pago-mas-opciones');
    escribir('onb-pago-restantes', '4');
    tocar('onb-pago-agregar');
    const lista = screen.getByTestId('onb-pagos-lista');
    expect(lista).toHaveTextContent(/Clases de inglés/);
    expect(lista).toHaveTextContent(/cada martes/);
    expect(lista).toHaveTextContent(/hasta /);
    // 300 a la semana → 52/12 → $1,300.00 al mes (hacia arriba, regla 12).
    expect(screen.getByTestId('onb-pagos-total')).toHaveTextContent(/1,300/);
    expect(screen.getByTestId('onb-pagos-total').props.accessibilityLabel).toMatch(/Al mes suman/);
    expect(screen.getByTestId(/^onb-pago-agregado-/).props.accessibilityLabel).toMatch(/termina el/);
    expect(screen.getByTestId('onb-pagos-continuar')).toHaveProp('accessibilityHint', PISTA_PAGOS_CONTINUAR);

    const id = String(screen.getByTestId(/^onb-pago-agregado-/).props.testID).replace(
      'onb-pago-agregado-',
      '',
    );
    tocar(`onb-pago-quitar-${id}`);
    expect(screen.queryByTestId('onb-pagos-lista')).toBeNull();
    expect(screen.getByTestId('onb-pagos-continuar')).toHaveProp('accessibilityHint', PISTA_PAGOS_SALTAR);
  });

  it('O5 · sin nombre no agrega; cada mes exige el día', () => {
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    abrir('/onboarding/pagos-fijos');
    tocar('onb-pago-otro');
    escribir('onb-pago-monto', '100');
    escribir('onb-pago-dia', '5');
    tocar('onb-pago-agregar');
    expect(screen.getByTestId('error-formulario')).toHaveTextContent(/cómo le llamas/);
    escribir('onb-pago-nombre', 'Seguro');
    escribir('onb-pago-dia', '');
    tocar('onb-pago-agregar');
    expect(screen.getByTestId('error-formulario')).toHaveTextContent(/cuándo lo pagas/);
    expect(screen.queryByTestId('onb-pagos-lista')).toBeNull();
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

describe('onboarding dictado («O dímelo»)', () => {
  function abrirConDictado(url: string) {
    const f = crearMotorFalso();
    const valor: DictadoCampos = {
      BotonDictar: (p: PropsBotonDictarCampo) => <BotonDictarCampo {...p} motor={f.motor} />,
      interpretarMonto,
    };
    const Envoltura = ({ children }: { children: ReactNode }) => (
      <s.Envoltura>
        <ContextoDictadoCampos.Provider value={valor}>{children}</ContextoDictadoCampos.Provider>
      </s.Envoltura>
    );
    return { r: renderRouter(RUTAS, { initialUrl: url, wrapper: Envoltura }), f };
  }

  it('O3: «me pagan 8 mil cada viernes» llena frecuencia, día y monto; nada se guarda hasta Continuar', async () => {
    const { r, f } = abrirConDictado('/');
    tocar('onb-empezar');
    tocar('onb-casilla-datos');
    tocar('onb-aceptar');
    const antes = conteoTablas();
    fireEvent(screen.getByTestId('onb-ingreso-decir-dictar'), 'pressIn');
    await act(async () => {});
    fireEvent(screen.getByTestId('onb-ingreso-decir-dictar'), 'pressOut');
    f.emitir({ tipo: 'resultado', texto: 'me pagan 8 mil cada viernes', final: true });
    expect(screen.getByTestId('onb-ingreso-decir-resultado')).toHaveTextContent(/Revisa los datos/);
    expect(screen.getByTestId('onb-ingreso-monto').props.value).toBe('8,000');
    expect(screen.getByTestId('onb-dia-semana-5')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('onb-proximo-pago')).toHaveTextContent(/vie 16/);
    expect(conteoTablas()).toEqual(antes);
    tocar('onb-ingreso-continuar');
    expect(r.getPathname()).toBe('/onboarding/cuentas');
  });

  it('O5: «pago 4500 de renta cada mes el 5» llena el formulario de Renta; se agrega al tocar Agregar', async () => {
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    const { f } = abrirConDictado('/onboarding/pagos-fijos');
    const antes = conteoTablas();
    fireEvent(screen.getByTestId('onb-pago-decir-dictar'), 'pressIn');
    await act(async () => {});
    f.emitir({ tipo: 'resultado', texto: 'pago 4500 de renta cada mes el 5', final: true });
    expect(screen.getByTestId('onb-pago-nombre').props.value).toBe('Renta');
    expect(screen.getByTestId('onb-pago-dia').props.value).toBe('5');
    expect(screen.getByTestId('onb-pago-monto').props.value).toBe('4,500');
    expect(conteoTablas()).toEqual(antes);
  });

  it('O3: lo que no entiende no cambia nada', async () => {
    const { f } = abrirConDictado('/');
    tocar('onb-empezar');
    tocar('onb-casilla-datos');
    tocar('onb-aceptar');
    fireEvent(screen.getByTestId('onb-ingreso-decir-dictar'), 'pressIn');
    await act(async () => {});
    f.emitir({ tipo: 'resultado', texto: 'no sé cuánto gano', final: true });
    expect(screen.getByTestId('onb-ingreso-decir-resultado')).toHaveTextContent(/no lo entendí/);
    expect(screen.getByTestId('onb-ingreso-monto').props.value).toBe('');
  });
});
