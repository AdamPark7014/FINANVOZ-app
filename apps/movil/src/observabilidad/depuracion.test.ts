import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import { describe, expect, it } from 'vitest';
import { depurarEvento, depurarMiga, depurarTexto, esCodigo, TEXTO_DEPURADO } from './depuracion';

/**
 * CA-M2-06 / RNF-05: estos datos de una persona no pueden aparecer en ningún evento que salga
 * hacia Sentry. La prueba falla si alguno sobrevive a la depuración.
 */
const SENSIBLES = {
  montos: ['$1,234.56', '1,234.56', '1234.56', '$25', '$ 2,000', '−$374', '109990', '150000', '25 pesos'],
  comercios: ['OXXO', 'Insurgentes', 'WALMART', 'Soriana', 'Tacos El Güero', 'Netflix'],
  alias: ['la jefa', 'mi compa Toño', 'Toño', 'el Beto'],
  nombres: ['María López', 'Adam', 'López'],
  rfc: ['LOPM800101AB1', 'LOPM800101'],
  dictado: ['me compré una coca de 25 en efectivo', 'coca de 25', 'le pasé 200 a mi jefa'],
  notificacion: ['BBVA: Compra por $1,099.90 en WALMART con tarjeta *4321', '*4321', '4321'],
  cuentas: ['5512345678', '012180001234567891', 'maria.lopez@gmail.com'],
};

const FRASE_DICTADA = 'me compré una coca de 25 en efectivo';
const NOTIFICACION = 'BBVA: Compra por $1,099.90 en WALMART con tarjeta *4321';

class ErrorDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDominio';
  }
}

function eventoSucio(): ErrorEvent {
  return {
    type: undefined,
    event_id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    timestamp: 1_760_000_000.123,
    level: 'error',
    platform: 'javascript',
    release: 'com.finanvoz.app@0.1.0+1',
    environment: 'development',
    message: `No pude registrar ${FRASE_DICTADA}`,
    logentry: { message: 'Gasto %s en %s', params: ['$1,234.56', 'OXXO Insurgentes'] },
    transaction: '/movimientos/OXXO?monto=150000',
    server_name: 'Teléfono de María López',
    fingerprint: ['{{ default }}', 'OXXO'],
    user: {
      id: 'maria.lopez@gmail.com',
      username: 'María López',
      email: 'maria.lopez@gmail.com',
      ip_address: '10.0.0.1',
    },
    request: {
      url: 'https://proxy.finanvoz.com/nlu/interpretar?texto=coca%20de%2025',
      data: { texto: FRASE_DICTADA, alias: 'la jefa' },
      headers: { Authorization: 'Bearer secreto' },
      cookies: { s: 'x' },
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: `Saldo insuficiente en BBVA: tienes $1,234.56 y el gasto en Tacos El Güero es de $2,000 (alias: mi compa Toño)`,
          mechanism: { type: 'generic', handled: true, data: { mensaje: NOTIFICACION } },
          stacktrace: {
            frames: [
              {
                filename: 'app:///index.android.bundle',
                function: 'registrarGasto',
                lineno: 12,
                colno: 34,
                in_app: true,
                vars: { monto: 150000, comercio: 'Soriana', alias: 'el Beto' },
                context_line: "registrar({ monto: 109990, comercio: 'Netflix' })",
                pre_context: ['// le pasé 200 a mi jefa'],
                post_context: ['RFC LOPM800101AB1'],
              },
            ],
          },
        },
        {
          type: 'TypeError',
          value: "Cannot read property 'monto' of undefined",
          stacktrace: { frames: [{ filename: 'app:///index.android.bundle', function: 'hoy', lineno: 7 }] },
        },
      ],
    },
    breadcrumbs: [
      {
        category: 'console',
        level: 'log',
        message: `interpretando: ${FRASE_DICTADA}`,
        data: { arguments: [FRASE_DICTADA] },
      },
      {
        category: 'touch',
        message: 'Touch event within element: Registré: Coca $25 · Antojos · Efectivo',
        data: { path: [{ name: 'Text', label: 'Hoy puedes gastar doscientos catorce pesos' }] },
      },
      { category: 'ui.click', message: 'Guardar gasto en OXXO por $1,234.56', data: { texto: 'la jefa' } },
      {
        category: 'navigation',
        data: {
          from: '/hoy',
          to: '/movimientos/550e8400-e29b-41d4-a716-446655440000?alias=la%20jefa',
          params: { alias: 'la jefa' },
        },
      },
      {
        category: 'xhr',
        type: 'http',
        data: {
          method: 'POST',
          status_code: 500,
          url: 'https://proxy.finanvoz.com/nlu/interpretar?texto=coca%20de%2025',
          body: FRASE_DICTADA,
        },
      },
      { category: 'sentry.event', message: 'Error: Saldo insuficiente en OXXO' },
      {
        category: 'notificacion',
        message: NOTIFICACION,
        data: { paquete: 'com.bbva.bbvacontigo', texto: NOTIFICACION },
      },
      { category: 'finanvoz.registro', message: 'registro_optimista', data: { monto: 2500 } },
      { category: 'app.lifecycle', data: { state: 'background' } },
    ],
    tags: {
      'event.origin': 'javascript',
      pantalla: 'hoy',
      comercio: 'OXXO',
      monto: '$1,234.56',
      origen: 'Tacos El Güero $80',
    },
    extra: {
      codigo: 'interpretacion_fallida',
      paso: 3,
      texto_dictado: FRASE_DICTADA,
      notificacion: NOTIFICACION,
      monto: 150000,
      alias: 'la jefa',
      persona: { nombre: 'María López', rfc: 'LOPM800101AB1' },
    },
    contexts: {
      device: { name: 'Teléfono de María López', model: 'Pixel 7', family: 'Android', simulator: false },
      os: { name: 'Android', version: '15' },
      app: { app_identifier: 'com.finanvoz.app', app_version: '0.1.0', app_name: 'Finanvoz' },
      movimiento: { monto: 150000, comercio: 'OXXO', alias: 'la jefa' },
      culture: { locale: 'es-MX', timezone: 'America/Mexico_City' },
      state: { state: { type: 'redux', value: { ultimoTexto: FRASE_DICTADA } } },
    },
  };
}

/** Recorre todo el evento y devuelve [ruta, valor] de cada hoja. */
function hojas(valor: unknown, ruta = '$'): [string, unknown][] {
  if (valor === null || typeof valor !== 'object') return [[ruta, valor]];
  return Object.entries(valor).flatMap(([k, v]) => hojas(v, `${ruta}.${k}`));
}

/** Rutas con identificadores técnicos (no los escribe la persona). */
const RUTAS_TECNICAS =
  /^\$\.(event_id|timestamp|release|contexts\.(device|os|app)\.|exception\.values\.\d+\.stacktrace\.frames\.\d+\.(lineno|colno)|breadcrumbs\.\d+\.(timestamp|data\.status_code)$)/;

function verificarLimpio(evento: unknown) {
  const json = JSON.stringify(evento).toLowerCase();
  for (const [grupo, valores] of Object.entries(SENSIBLES)) {
    for (const v of valores) {
      expect(json, `${grupo}: "${v}" sobrevivió`).not.toContain(v.toLowerCase());
    }
  }
  for (const [ruta, v] of hojas(evento)) {
    if (RUTAS_TECNICAS.test(ruta)) continue;
    const texto = String(v);
    expect(texto, `${ruta} trae algo con forma de monto`).not.toMatch(/\$\s?\d/);
    expect(texto, `${ruta} trae 3 o más dígitos seguidos`).not.toMatch(/\d{3,}/);
    expect(texto, `${ruta} trae una cifra con separadores`).not.toMatch(/\d[,.]\d{2}/);
  }
}

describe('CA-M2-06: ningún dato de la persona llega a Sentry', () => {
  it('el evento sucio de referencia sí trae datos (control de la prueba)', () => {
    expect(() => verificarLimpio(eventoSucio())).toThrow();
  });

  it('beforeSend deja el evento sin montos, comercios, alias, nombres ni texto dictado', () => {
    const limpio = depurarEvento(eventoSucio(), { originalException: new Error('x') });
    verificarLimpio(limpio);
  });

  it('conserva lo necesario para diagnosticar', () => {
    const limpio = depurarEvento(eventoSucio());
    expect(limpio.event_id).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(limpio.release).toBe('com.finanvoz.app@0.1.0+1');
    expect(limpio.exception?.values?.[0]).toMatchObject({
      type: 'Error',
      value: TEXTO_DEPURADO,
      mechanism: { type: 'generic', handled: true },
      stacktrace: {
        frames: [{ filename: 'app:///index.android.bundle', function: 'registrarGasto', lineno: 12 }],
      },
    });
    expect(limpio.exception?.values?.[1]?.value).toBe("Cannot read property 'monto' of undefined");
    expect(limpio.tags).toEqual({ 'event.origin': 'javascript', pantalla: 'hoy' });
    expect(limpio.extra).toEqual({ codigo: 'interpretacion_fallida', paso: 3 });
    expect(limpio.contexts?.device).toEqual({ model: 'Pixel 7', family: 'Android', simulator: false });
    expect(Object.keys(limpio.contexts ?? {}).sort()).toEqual(['app', 'device', 'os']);
    expect(limpio.user).toBeUndefined();
    expect(limpio.request).toBeUndefined();
    expect(limpio.server_name).toBeUndefined();
    expect(limpio.breadcrumbs?.map((m) => m.category)).toEqual([
      'touch',
      'ui.click',
      'navigation',
      'xhr',
      'sentry.event',
      'notificacion',
      'finanvoz.registro',
      'app.lifecycle',
    ]);
    expect(limpio.breadcrumbs?.find((m) => m.category === 'finanvoz.registro')?.message).toBe(
      'registro_optimista',
    );
  });

  it('etiquetas y extras permitidos solo aceptan valores de catálogo, identificadores o números chicos', () => {
    const limpio = depurarEvento({
      type: undefined,
      tags: { origen: 'voz', espacio: 'Tacos El Güero', pantalla: 'OXXO Insurgentes', paso: '3' },
      extra: { paso: 4, version_esquema: 150000, resultado: 'faltante', codigo: 'la jefa' },
    });
    expect(limpio.tags).toEqual({ origen: 'voz' });
    expect(limpio.extra).toEqual({ paso: 4, resultado: 'faltante' });
  });

  it('un ErrorDominio se reporta por su código, no por su mensaje', () => {
    const e = eventoSucio();
    const limpio = depurarEvento(e, {
      originalException: new ErrorDominio('monto_invalido', 'monto 150000 en OXXO no cuadra'),
    });
    expect(limpio.exception?.values?.[0]?.value).toBe('monto_invalido');
    verificarLimpio(limpio);
  });

  it('captureMessage solo admite códigos', () => {
    expect(depurarEvento({ type: undefined, message: 'migracion_fallida' }).message).toBe(
      'migracion_fallida',
    );
    expect(depurarEvento({ type: undefined, message: 'oxxo' }).message).toBe(TEXTO_DEPURADO);
    expect(depurarEvento({ type: undefined, message: NOTIFICACION }).message).toBe(TEXTO_DEPURADO);
  });

  it('las rutas pierden parámetros e identificadores', () => {
    const limpio = depurarEvento(eventoSucio());
    const nav = limpio.breadcrumbs?.find((m) => m.category === 'navigation');
    expect(nav?.data).toEqual({ from: '/hoy', to: '/movimientos/[id]' });
    const red = limpio.breadcrumbs?.find((m) => m.category === 'xhr');
    expect(red?.data).toEqual({
      method: 'POST',
      status_code: 500,
      url: 'https://proxy.finanvoz.com/nlu/interpretar',
    });
  });
});

describe('beforeBreadcrumb', () => {
  it('descarta la consola', () => {
    expect(depurarMiga({ category: 'console', message: FRASE_DICTADA })).toBeNull();
  });

  it.each<Breadcrumb>([
    { category: 'touch', message: 'Touch event within element: Coca $25', data: { label: 'la jefa' } },
    { category: 'ui.input', message: FRASE_DICTADA },
    { category: 'notificacion', message: NOTIFICACION, data: { texto: NOTIFICACION } },
    { category: 'sentry.transaction', message: 'OXXO $1,234.56' },
  ])('quita texto y datos de %o', (miga) => {
    const limpia = depurarMiga(miga);
    expect(limpia?.message).toBeUndefined();
    expect(limpia?.data).toBeUndefined();
    verificarLimpio(limpia);
  });
});

describe('depurarTexto', () => {
  it.each([
    ['Compra por $1,099.90 en tienda', 'Compra por [monto] en tienda'],
    ['gasté −$374', 'gasté [monto]'],
    ['me pagaron 2,000', 'me pagaron [n]'],
    ['coca 25 pesos', 'coca [monto]'],
    ['tarjeta 5512 3456 7890 1234', 'tarjeta [n]'],
    ['correo maria.lopez@gmail.com', 'correo [correo]'],
    ['RFC LOPM800101AB1', 'RFC [rfc]'],
    ['paso 3 de 7', 'paso 3 de 7'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(depurarTexto(entrada)).toBe(esperado);
  });

  it('esCodigo exige snake_case con guion bajo', () => {
    expect(esCodigo('monto_invalido')).toBe(true);
    expect(esCodigo('oxxo')).toBe(false);
    expect(esCodigo('la_jefa ')).toBe(false);
    expect(esCodigo('Monto_invalido')).toBe(false);
  });
});
