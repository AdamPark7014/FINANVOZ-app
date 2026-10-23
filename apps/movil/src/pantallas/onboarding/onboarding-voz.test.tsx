import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import Captura from '../../../app/onboarding/captura';
import Colchon from '../../../app/onboarding/colchon';
import Cuentas from '../../../app/onboarding/cuentas';
import Ingreso from '../../../app/onboarding/ingreso';
import OnboardingLayout from '../../../app/onboarding/_layout';
import PagosFijos from '../../../app/onboarding/pagos-fijos';
import TarjetaCredito from '../../../app/onboarding/tarjeta';
import {
  aceptarConsentimiento,
  agregarCuenta,
  exportarJson,
  leerMontoDictado,
  listarCuentas,
  obtenerAjustes,
  obtenerHoy,
  onboardingCompletado,
} from '../../servicios';
import { ProveedorDictado } from '../../voz';
import { crearMotorFalso } from '../../voz/__pruebas__/motor-falso';
import { crearSesionPrueba, type SesionPrueba } from './__pruebas__/sesion';
import { PISTA_PAGOS_CONTINUAR } from './textos';

/**
 * Onboarding por voz (Ola 7 §7, CA-O7 criterio 7): cada paso dicho termina en «Entendí». O3 y O7: «Sí» guarda y
 * sigue sin formulario. O4 y O5: «Sí» guarda lo completo y lo incompleto llena el formulario. «Cambiar algo» deja el
 * formulario con lo leído. Lo que no se entiende deja una línea honesta y el formulario como estaba.
 */
const RUTAS = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  'onboarding/_layout': OnboardingLayout,
  'onboarding/ingreso': Ingreso,
  'onboarding/cuentas': Cuentas,
  'onboarding/tarjeta': TarjetaCredito,
  'onboarding/pagos-fijos': PagosFijos,
  'onboarding/captura': Captura,
  'onboarding/colchon': Colchon,
  '(tabs)/hoy': () => <Text testID="pestana-hoy">Hoy</Text>,
};

let s: SesionPrueba;
let f: ReturnType<typeof crearMotorFalso>;
// El micrófono ignora un segundo toque dentro del rebote: cada frase dicha llega segundos después de la anterior.
let ahora = 0;
beforeEach(() => {
  ahora = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  s = crearSesionPrueba('2026-10-11');
  aceptarConsentimiento(s.ctx, { datosFinancieros: true });
  f = crearMotorFalso();
});
afterEach(() => {
  s.cerrar();
  jest.restoreAllMocks();
});

function abrir(url: string) {
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <s.Envoltura>
      <ProveedorDictado motor={f.motor} leerMonto={leerMontoDictado}>
        {children}
      </ProveedorDictado>
    </s.Envoltura>
  );
  return renderRouter(RUTAS, { initialUrl: url, wrapper: Envoltura });
}

/** Filas de cada tabla: si no cambian, no se escribió nada. */
function conteoTablas(): Record<string, number> {
  const { tablas } = JSON.parse(exportarJson(s.ctx)) as { tablas: Record<string, unknown[]> };
  return Object.fromEntries(Object.entries(tablas).map(([t, filas]) => [t, filas.length]));
}

/** Toca el micrófono de «Dímelo», dice la frase y suelta. */
async function decir(prefijo: string, texto: string) {
  ahora += 10_000;
  jest.spyOn(Date, 'now').mockReturnValue(ahora);
  const mic = () => screen.getByTestId(`${prefijo}-dictar`);
  await act(async () => {
    fireEvent(mic(), 'pressIn');
  });
  fireEvent(mic(), 'pressOut');
  f.emitir({ tipo: 'resultado', texto, final: true });
  // «sí» dicho confirma en una promesa: se deja terminar antes de mirar.
  await act(async () => {});
}

async function tocar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

const valor = (testID: string) => screen.getByTestId(testID).props.value as string;

describe('O3 · ingreso dicho', () => {
  const D = 'onb-ingreso-decir';

  it('«gano 13 mil cada quincena» → Entendí → «Sí» guarda y pasa a O4 sin formulario', async () => {
    const r = abrir('/onboarding/ingreso');
    const antes = conteoTablas();
    await decir(D, 'gano 13 mil cada quincena');
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent('Dijiste «gano 13 mil cada quincena».');
    expect(screen.getByTestId(`${D}-entendi-monto`)).toHaveTextContent(/13,000/);
    expect(screen.getByTestId(`${D}-entendi-fila-frecuencia`)).toHaveTextContent(/Cada quincena/);
    expect(screen.getByTestId(`${D}-entendi-fila-proximo`)).toHaveTextContent(/jue 15/);
    expect(screen.getByTestId(`${D}-entendi-confirmar`)).toHaveTextContent('Sí, así es');
    expect(conteoTablas()).toEqual(antes);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/cuentas');
    expect(obtenerHoy(s.ctx).proximoIngreso).toEqual({
      concepto: 'quincena',
      fecha: '2026-10-15',
      etiqueta: 'jue 15',
    });
  });

  it('incompleto («me pagan 4 mil a la semana»): «Sí» llena el formulario y no guarda', async () => {
    const r = abrir('/onboarding/ingreso');
    const antes = conteoTablas();
    await decir(D, 'me pagan 4 mil a la semana');
    expect(screen.getByTestId(`${D}-entendi-efecto`)).toHaveTextContent('Me falta saber qué día te pagan.');
    expect(screen.getByTestId(`${D}-entendi-fila-dia_semana`)).toHaveTextContent(/Falta/);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/ingreso');
    expect(screen.queryByTestId(`${D}-entendi`)).toBeNull();
    expect(screen.getByTestId('onb-frecuencia-semanal')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('onb-dia-semana-grupo')).toBeTruthy();
    expect(valor('onb-ingreso-monto')).toBe('4,000');
    expect(conteoTablas()).toEqual(antes);
  });

  it('«Cambiar algo» deja lo dicho en el formulario para revisarlo', async () => {
    const r = abrir('/onboarding/ingreso');
    const antes = conteoTablas();
    await decir(D, 'me pagan 15 mil cada mes el 30');
    await tocar(`${D}-entendi-cambiar`);
    expect(r.getPathname()).toBe('/onboarding/ingreso');
    expect(valor('onb-ingreso-monto')).toBe('15,000');
    expect(valor('onb-dia-mes')).toBe('30');
    expect(conteoTablas()).toEqual(antes);
    await tocar('onb-ingreso-continuar');
    expect(r.getPathname()).toBe('/onboarding/cuentas');
  });

  it('lo que no entiende lo dice y no cambia nada', async () => {
    abrir('/onboarding/ingreso');
    await decir(D, 'no sé cuánto gano');
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent(/no lo entendí/);
    expect(screen.queryByTestId(`${D}-entendi`)).toBeNull();
    expect(valor('onb-ingreso-monto')).toBe('');
  });

  it('con la tarjeta a la vista, «sí» dicho la confirma', async () => {
    const r = abrir('/onboarding/ingreso');
    await decir(D, 'me pagan 8 mil cada viernes');
    expect(screen.getByTestId(`${D}-entendi-fila-frecuencia`)).toHaveTextContent(/Cada viernes/);
    await decir(D, 'sí');
    expect(r.getPathname()).toBe('/onboarding/cuentas');
    expect(obtenerHoy(s.ctx).proximoIngreso?.fecha).toBe('2026-10-16');
  });

  it('«no, son 12 mil» corrige la cifra y se queda la quincena', async () => {
    abrir('/onboarding/ingreso');
    await decir(D, 'cada quincena, son como 13 mil');
    expect(screen.getByTestId(`${D}-entendi-efecto`)).toHaveTextContent(/aproximada/);
    await decir(D, 'no, son 12 mil');
    expect(screen.getByTestId(`${D}-entendi-monto`)).toHaveTextContent(/12,000/);
    expect(screen.getByTestId(`${D}-entendi-fila-frecuencia`)).toHaveTextContent(/Cada quincena/);
    await tocar(`${D}-entendi-confirmar`);
    expect(obtenerHoy(s.ctx).proximoIngreso?.concepto).toBe('quincena');
  });

  it('el fin de semana se cambia tocando su fila', async () => {
    abrir('/onboarding/ingreso');
    await decir(D, 'gano 13 mil cada quincena');
    fireEvent.press(screen.getByLabelText('Si cae en fin de semana: Antes'));
    expect(screen.getByTestId(`${D}-entendi-fila-fin_de_semana`)).toHaveTextContent(/Antes/);
    await tocar(`${D}-entendi-opcion-fin_de_semana-despues`);
    expect(screen.getByTestId(`${D}-entendi-fila-fin_de_semana`)).toHaveTextContent(/Después/);
  });
});

describe('O4 · cuentas dichas', () => {
  const D = 'onb-cuentas-decir';

  it('«tengo 3 mil en BBVA y 500 en efectivo» → «Sí» agrega las dos y se queda en O4', async () => {
    const r = abrir('/onboarding/cuentas');
    const antes = conteoTablas();
    await decir(D, 'tengo 3 mil en BBVA y 500 en efectivo');
    expect(screen.getByTestId(`${D}-entendi`)).toHaveTextContent(/¿las agrego\?/);
    expect(screen.getByTestId(`${D}-entendi-fila-efectivo`)).toHaveTextContent(/500/);
    expect(screen.getByTestId(`${D}-entendi-fila-cuenta-0`)).toHaveTextContent(/BBVA · Débito/);
    expect(conteoTablas()).toEqual(antes);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/cuentas');
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent('Listo: agregué BBVA y tu efectivo.');
    expect(listarCuentas(s.ctx).tienes.map((c) => [c.nombre, c.saldo])).toEqual([
      ['Efectivo', 50_000],
      ['BBVA', 300_000],
    ]);
    expect(screen.queryByTestId('onb-efectivo')).toBeNull();
    expect(screen.getByTestId('onb-cuentas-lista')).toHaveTextContent(/BBVA/);
  });

  it('«Cambiar algo» pone el efectivo en su campo y BBVA en el formulario, sin guardar', async () => {
    abrir('/onboarding/cuentas');
    const antes = conteoTablas();
    await decir(D, 'tengo 3 mil en BBVA y 500 en efectivo');
    await tocar(`${D}-entendi-cambiar`);
    expect(valor('onb-efectivo')).toBe('500');
    expect(valor('onb-cuenta-nombre')).toBe('BBVA');
    expect(valor('onb-cuenta-saldo')).toBe('3,000');
    // Nombre y saldo ya están: el foco va al saldo (lo más fácil de oír mal), no al nombre.
    expect(screen.getByTestId('onb-cuenta-saldo')).toHaveProp('autoFocus', true);
    expect(screen.getByTestId('onb-cuenta-nombre')).toHaveProp('autoFocus', false);
    expect(conteoTablas()).toEqual(antes);
  });

  it('una tarjeta dicha en O4 a la que le falta algo abre su formulario con lo dicho', async () => {
    const r = abrir('/onboarding/cuentas');
    await decir(D, 'tengo una Nu que corta el 28 y pago el 18');
    expect(screen.getByTestId(`${D}-entendi`)).toHaveTextContent(/¿la agrego\?/);
    expect(screen.getByTestId(`${D}-entendi-efecto`)).toHaveTextContent(
      'Me falta saber tu límite de crédito, si la pagas completa y cuánto debes hoy.',
    );
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/tarjeta');
    expect(valor('tarjeta-nombre')).toBe('Nu');
    expect(valor('tarjeta-corte')).toBe('28');
    expect(screen.getByTestId('onb-tarjeta-pendiente')).toHaveTextContent(/tu límite de crédito/);
    expect(listarCuentas(s.ctx).debes).toEqual([]);
  });

  it('lo que ya está en la lista no se agrega otra vez', async () => {
    agregarCuenta(s.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 100_000 });
    abrir('/onboarding/cuentas');
    const antes = conteoTablas();
    await decir(D, 'tengo 4 mil en BBVA');
    expect(screen.getByTestId(`${D}-entendi-efecto`)).toHaveTextContent(/BBVA ya está en tu lista/);
    await tocar(`${D}-entendi-confirmar`);
    expect(conteoTablas()).toEqual(antes);
    expect(screen.queryByTestId(`${D}-entendi`)).toBeNull();
  });

  it('un banco que no conoce no inventa una cuenta', async () => {
    abrir('/onboarding/cuentas');
    await decir(D, 'tengo 500 en Banjército');
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent(/no lo entendí/);
    expect(screen.queryByTestId(`${D}-entendi`)).toBeNull();
  });
});

describe('O4 · tarjeta de crédito dicha', () => {
  const D = 'onb-tarjeta-decir';

  it('dicha completa, «Sí» la agrega sin formulario y vuelve a cuentas', async () => {
    const r = abrir('/onboarding/cuentas');
    fireEvent.press(screen.getByTestId('onb-agregar-tarjeta'));
    expect(r.getPathname()).toBe('/onboarding/tarjeta');
    await decir(
      D,
      'tengo una Oro que corta el 28 y pago el 20, debo 8 mil, mi límite es de 30 mil y la pago completa',
    );
    expect(screen.getByTestId(`${D}-entendi-fila-saldo`)).toHaveTextContent(/8,000/);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/cuentas');
    expect(listarCuentas(s.ctx).debes.map((d) => [d.nombre, d.saldo])).toEqual([['Oro', 800_000]]);
  });

  it('con datos que faltan, «Sí» llena el formulario con todo lo dicho y solo pide lo que falta', async () => {
    const r = abrir('/onboarding/cuentas');
    fireEvent.press(screen.getByTestId('onb-agregar-tarjeta'));
    await decir(D, 'tengo una Nu que corta el 28 y pago el 18, debo 2 mil');
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/onboarding/tarjeta');
    expect(valor('tarjeta-nombre')).toBe('Nu');
    expect(valor('tarjeta-corte')).toBe('28');
    expect(valor('tarjeta-limite-pago')).toBe('18');
    // Lo dicho ya va escrito (no se vuelve a pedir); solo falta el límite y si la paga completa.
    expect(valor('tarjeta-saldo')).toBe('2,000');
    expect(screen.getByTestId('onb-tarjeta-pendiente')).toHaveTextContent(
      'Escribe abajo tu límite de crédito y si la pagas completa.',
    );
    expect(listarCuentas(s.ctx).debes).toEqual([]);
  });

  it('desde O4, la tarjeta dicha con modo y límite llega escrita y solo queda pendiente el saldo', async () => {
    const r = abrir('/onboarding/cuentas');
    await decir(
      'onb-cuentas-decir',
      'tengo una Nu que corta el 28 y pago el 18, mi límite es de 30 mil y la pago completa',
    );
    await tocar('onb-cuentas-decir-entendi-confirmar');
    expect(r.getPathname()).toBe('/onboarding/tarjeta');
    expect(valor('tarjeta-nombre')).toBe('Nu');
    expect(valor('tarjeta-limite-credito')).toBe('30,000');
    expect(screen.getByTestId('tarjeta-completa-si')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('onb-tarjeta-pendiente')).toHaveTextContent('Escribe abajo cuánto debes hoy.');
    expect(listarCuentas(s.ctx).debes).toEqual([]);
  });
});

describe('O5 · pagos fijos dichos', () => {
  const D = 'onb-pago-decir';

  it('«pago 4500 de renta cada mes el 5» → «Sí» lo agrega a la lista', async () => {
    abrir('/onboarding/pagos-fijos');
    await decir(D, 'pago 4500 de renta cada mes el 5');
    expect(screen.getByTestId(`${D}-entendi`)).toHaveTextContent(/¿lo agrego\?/);
    expect(screen.getByTestId(`${D}-entendi-fila-pago-0`)).toHaveTextContent(/Renta · día 5 de cada mes/);
    await tocar(`${D}-entendi-confirmar`);
    expect(screen.getByTestId('onb-pagos-lista')).toHaveTextContent(/Renta/);
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent('Listo: agregué Renta.');
    expect(screen.getByTestId('onb-pagos-continuar')).toHaveProp('accessibilityHint', PISTA_PAGOS_CONTINUAR);
  });

  it('uno completo y uno sin día: agrega el completo y deja el otro en el formulario', async () => {
    abrir('/onboarding/pagos-fijos');
    await decir(D, 'el internet 500 el 10 y Netflix 219 cada mes');
    expect(screen.getByTestId(`${D}-entendi-efecto`)).toHaveTextContent(
      'Me falta saber qué día pagas Netflix.',
    );
    await tocar(`${D}-entendi-confirmar`);
    expect(screen.getByTestId('onb-pagos-lista')).toHaveTextContent(/Internet/);
    expect(screen.getByTestId('onb-pagos-lista')).not.toHaveTextContent(/Netflix/);
    expect(valor('onb-pago-nombre')).toBe('Netflix');
    expect(valor('onb-pago-monto')).toBe('219');
    // El foco va al primer dato que falta: el día.
    expect(screen.getByTestId('onb-pago-dia')).toHaveProp('autoFocus', true);
    expect(screen.getByTestId('onb-pago-monto')).toHaveProp('autoFocus', false);
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent(
      'Listo: agregué Internet. Completa Netflix abajo.',
    );
  });

  it('«Cambiar algo» deja el pago en el formulario sin agregarlo', async () => {
    abrir('/onboarding/pagos-fijos');
    const antes = conteoTablas();
    await decir(D, 'pago 4500 de renta cada mes el 5');
    await tocar(`${D}-entendi-cambiar`);
    expect(valor('onb-pago-nombre')).toBe('Renta');
    expect(valor('onb-pago-dia')).toBe('5');
    expect(valor('onb-pago-monto')).toBe('4,500');
    expect(screen.queryByTestId('onb-pagos-lista')).toBeNull();
    expect(conteoTablas()).toEqual(antes);
  });

  it('lo que no es un pago fijo no se agrega', async () => {
    abrir('/onboarding/pagos-fijos');
    await decir(D, 'gané 500');
    expect(screen.getByTestId(`${D}-resultado`)).toHaveTextContent(/no lo entendí/);
    expect(screen.queryByTestId('onb-pagos-lista')).toBeNull();
  });
});

describe('O7 · colchón dicho', () => {
  const D = 'onb-colchon-decir';

  it('«quiero 2 mil de colchón» → «Sí» guarda, termina el recorrido y abre tu día', async () => {
    const r = abrir('/onboarding/colchon');
    await decir(D, 'quiero 2 mil de colchón');
    expect(screen.getByTestId(`${D}-entendi`)).toHaveTextContent(/¿lo guardo\?/);
    expect(screen.getByTestId(`${D}-entendi-monto`)).toHaveTextContent(/2,000/);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/hoy');
    expect(obtenerAjustes(s.ctx).colchon).toBe(200_000);
    expect(onboardingCompletado(s.ctx)).toBe(true);
  });

  it('«nada» también vale: sin colchón por ahora', async () => {
    const r = abrir('/onboarding/colchon');
    await decir(D, 'nada');
    expect(screen.getByTestId(`${D}-entendi-fila-colchon`)).toHaveTextContent(/Sin colchón por ahora/);
    await tocar(`${D}-entendi-confirmar`);
    expect(r.getPathname()).toBe('/hoy');
    expect(obtenerAjustes(s.ctx).colchon).toBe(0);
  });

  it('«Cambiar algo» pone la cifra en el campo y no guarda', async () => {
    const r = abrir('/onboarding/colchon');
    await decir(D, 'quiero 2 mil de colchón');
    await tocar(`${D}-entendi-cambiar`);
    expect(r.getPathname()).toBe('/onboarding/colchon');
    expect(valor('onb-colchon-monto')).toBe('2,000');
    expect(onboardingCompletado(s.ctx)).toBe(false);
  });
});
