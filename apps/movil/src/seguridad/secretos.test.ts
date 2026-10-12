import { describe, expect, it } from 'vitest';
import { buscarSecretos } from './secretos';

/** Se arman en tiempo de ejecución para que ningún escáner confunda la prueba con una llave real. */
const x = (n: number, c = 'a') => c.repeat(n);
const jwt = (payload: object) =>
  [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    x(43, 'b'),
  ].join('.');

describe('búsqueda de secretos en el binario (08 §7.1, regla 8)', () => {
  it.each([
    ['anthropic', `const k = "${'sk-ant-'}api03-${x(80)}";`],
    ['openai', `"${'sk-'}proj-${x(48)}"`],
    ['google', `${'AIza'}${x(35, 'Q')}`],
    ['supabase_service_role', `apikey:"${jwt({ role: 'service_role', iss: 'supabase' })}"`],
    ['revenuecat_secreta', `${'sk_'}${x(32, 'Z')}`],
    ['sentry_token', `${'sntrys_'}${x(60, 'k')}`],
    ['posthog_personal', `${'phx_'}${x(40, 'p')}`],
    ['llave_privada', `-----BEGIN ${'PRIVATE'} KEY-----\nMIIE`],
  ])('detecta %s', (nombre, contenido) => {
    expect(buscarSecretos(contenido)).toEqual([nombre]);
  });

  it('permite lo público: llave anon de Supabase, llave de proyecto de PostHog, DSN de Sentry y llave pública', () => {
    const publico = [
      jwt({ role: 'anon', iss: 'supabase' }),
      `phc_${x(43, 'c')}`,
      'https://abc123@o123.ingest.us.sentry.io/456',
      '-----BEGIN PUBLIC KEY-----',
      'goog_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef', // llave pública de RevenueCat (Android)
      'texto normal con sk-8 y AIza corto',
      // Tabla de textos de Hermes: identificadores pegados que contienen "sk-" a media palabra.
      `-webkit-mask-size_equals__exportStarjeta-msi-mensualidad-procesar`,
    ].join('\n');
    expect(buscarSecretos(publico)).toEqual([]);
  });
});
