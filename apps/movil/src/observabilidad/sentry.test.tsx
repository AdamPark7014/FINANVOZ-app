import * as Sentry from '@sentry/react-native';
import type { ReactNativeOptions } from '@sentry/react-native';
import { ErrorDominio } from '@cartera/core';
import { iniciarSentry, leerDsn, opcionesSentry } from './sentry';

/**
 * CA-M2-06 con el SDK real: se inicia Sentry con un transporte que intercepta los sobres y se
 * reportan errores, mensajes y migas con datos de una persona. La prueba falla si alguno sale.
 */

// El SDK real. Sus intervalos de limpieza (AsyncExpiringMap) y el rastreo de promesas
// rechazadas de RN (el módulo nativo no existe en Jest) no deben mantener vivo a Jest: en este
// archivo los temporizadores no retienen el proceso.
jest.mock('@sentry/react-native', () => {
  const sinRetener = <F extends typeof setInterval | typeof setTimeout>(f: F): F =>
    ((...args: Parameters<F>) => {
      const t = (f as (...a: Parameters<F>) => unknown)(...args);
      (t as { unref?: () => void }).unref?.();
      return t;
    }) as F;
  global.setInterval = sinRetener(global.setInterval);
  global.setTimeout = sinRetener(global.setTimeout);
  return jest.requireActual('@sentry/react-native');
});

const DSN = 'https://clave@o0.ingest.sentry.io/0';
const SENSIBLES = [
  '1,234.56',
  '$25',
  '150000',
  '109990',
  'oxxo',
  'insurgentes',
  'walmart',
  'la jefa',
  'toño',
  'maría',
  'lópez',
  'coca de 25',
  'me compré',
  'compra por',
  '4321',
  'lopm800101',
];

type Sobre = [unknown, [unknown, unknown][]];

function iniciarInterceptado() {
  const sobres: Sobre[] = [];
  const transporte: ReactNativeOptions['transport'] = () => ({
    send: async (sobre) => {
      sobres.push(sobre as unknown as Sobre);
      return {};
    },
    flush: async () => true,
  });
  iniciarSentry({ dsn: DSN, entorno: 'test', transporte });
  return sobres;
}

function eventosEnviados(sobres: Sobre[]): unknown[] {
  return sobres.flatMap(([, items]) =>
    items
      .filter(([cabecera]) => (cabecera as { type?: string }).type === 'event')
      .map(([, cuerpo]) => cuerpo),
  );
}

describe('Sentry con el SDK real (CA-M2-06)', () => {
  afterEach(async () => {
    await Sentry.close();
  });

  it('ningún evento enviado contiene montos, comercios, alias, nombres ni texto dictado', async () => {
    const sobres = iniciarInterceptado();

    Sentry.addBreadcrumb({ category: 'console', message: 'dictado: me compré una coca de 25' });
    Sentry.addBreadcrumb({
      category: 'touch',
      message: 'Touch event within element: Registré: Coca $25 · Antojos · Efectivo',
      data: { label: 'Le debo a la jefa $1,234.56' },
    });
    Sentry.addBreadcrumb({ category: 'captura', message: 'BBVA: Compra por $1,099.90 en WALMART *4321' });
    Sentry.setUser({ id: 'maria.lopez@gmail.com', username: 'María López' });
    Sentry.setTag('comercio', 'OXXO Insurgentes');
    Sentry.setExtra('texto_dictado', 'me compré una coca de 25 en efectivo');
    Sentry.setContext('movimiento', { monto: 150000, alias: 'mi compa Toño' });

    Sentry.captureException(new Error('No cuadra $1,234.56 en OXXO Insurgentes para la jefa'));
    Sentry.captureException(new ErrorDominio('monto_invalido', 'monto 109990 de María López'));
    Sentry.captureMessage('Usuario María López dictó: me compré una coca de 25');
    await Sentry.flush();

    const eventos = eventosEnviados(sobres);
    expect(eventos).toHaveLength(3);
    const json = JSON.stringify(eventos).toLowerCase();
    for (const s of SENSIBLES) expect(json).not.toContain(s);
    expect(json).not.toMatch(/\$\s?\d/);
    expect(json).toContain('monto_invalido');
  });

  it('control: sin la depuración, el mismo interceptor sí ve los datos', async () => {
    const sobres: Sobre[] = [];
    Sentry.init({
      dsn: DSN,
      transport: () => ({
        send: async (sobre) => {
          sobres.push(sobre as unknown as Sobre);
          return {};
        },
        flush: async () => true,
      }),
    });
    Sentry.captureException(new Error('No cuadra $1,234.56 en OXXO Insurgentes para la jefa'));
    await Sentry.flush();
    expect(JSON.stringify(eventosEnviados(sobres)).toLowerCase()).toContain('oxxo');
  });

  it('sin DSN no se inicia', () => {
    const sdk = { init: jest.fn() };
    expect(iniciarSentry({ dsn: null, sdk })).toBe(false);
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it('las opciones apagan PII, capturas, árbol de vistas, rendimiento y repeticiones', () => {
    const sdk = { init: jest.fn() };
    expect(iniciarSentry({ dsn: DSN, entorno: 'production', sdk })).toBe(true);
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: 'production',
        sendDefaultPii: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      }),
    );
    const o = opcionesSentry({ dsn: DSN, entorno: 'test' });
    expect(o.beforeSendTransaction?.({ type: 'transaction' }, {})).toBeNull();
  });

  it('lee el DSN de extra o de la variable pública', () => {
    expect(leerDsn({ sentryDsn: DSN }, undefined)).toBe(DSN);
    expect(leerDsn({}, ` ${DSN} `)).toBe(DSN);
    expect(leerDsn({}, '')).toBeNull();
    expect(leerDsn(undefined, undefined)).toBeNull();
  });
});
