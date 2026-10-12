import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('llave de prueba de plantillas en el binario (CA-M10-04)', () => {
  const kat = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../fixtures/plantillas-firmadas/kat.json', import.meta.url)),
      'utf8',
    ),
  ) as { rfc8032_prueba_1: { llave_publica_hex: string; llave_secreta_hex: string } };
  const { llave_publica_hex: publica, llave_secreta_hex: secreta } = kat.rfc8032_prueba_1;
  const bytes = Buffer.from(publica, 'hex');

  it.each([
    ['hex en minúsculas (como la inlinea Metro desde EXPO_PUBLIC_PLANTILLAS_LLAVES)', `"prueba:${publica}"`],
    ['hex en mayúsculas', `x=${publica.toUpperCase()};`],
    ['base64', `k="${bytes.toString('base64')}"`],
    ['base64url sin relleno', `k='${bytes.toString('base64url')}'`],
    ['lista de bytes', `new Uint8Array([${[...bytes].join(', ')}])`],
    ['la llave secreta del vector', `"${secreta}"`],
  ])('detecta la llave en %s', (_forma, contenido) => {
    expect(buscarSecretos(contenido)).toEqual(['llave_prueba_plantillas']);
  });

  it('no confunde otras llaves ni hashes de 32 bytes', () => {
    const otra = 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025'; // vector 2 de RFC 8032
    const contenido = [otra, `${publica}00`, publica.slice(2), 'a'.repeat(43) + '='].join('\n');
    expect(buscarSecretos(contenido)).toEqual([]);
  });

  it('el código y la configuración de la app no la traen (el bundle se revisa en CI tras expo export)', () => {
    const app = fileURLToPath(new URL('../../', import.meta.url));
    const textos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(tsx?|json|js)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
          textos.push(readFileSync(ruta, 'utf8'));
        }
      }
    };
    recorrer(join(app, 'src'));
    recorrer(join(app, 'app'));
    textos.push(readFileSync(join(app, 'app.json'), 'utf8'));
    expect(textos.filter((t) => buscarSecretos(t).includes('llave_prueba_plantillas'))).toEqual([]);
  });
});
