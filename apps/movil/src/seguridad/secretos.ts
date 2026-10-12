/**
 * Patrones de secretos que nunca pueden viajar dentro de la app (regla 8, `08 §7.1`: "binario revisado con
 * `strings` en busca de secretos"). Lo público sí puede ir: la llave `anon` de Supabase, la llave de proyecto
 * de PostHog (`phc_`), el DSN de Sentry, la llave pública de RevenueCat y la llave pública de plantillas.
 * Lo usa `scripts/buscar-secretos.ts` sobre el bundle exportado (y sobre un APK descomprimido).
 *
 * La llave de prueba de plantillas (vector 1 de RFC 8032, `fixtures/plantillas-firmadas/kat.json`) es pública,
 * pero un build de producción que la trajera aceptaría plantillas firmadas por cualquiera (CA-M10-04). Se busca
 * por huella (SHA-256 de sus 32 bytes) en hexadecimal, base64 o lista de bytes, sin escribirla aquí.
 */
import { createHash } from 'node:crypto';

// `sk-` solo al inicio de un token: Hermes junta identificadores en su tabla de textos ("mask-size_…").
const PATRONES: readonly { nombre: string; patron: RegExp }[] = [
  { nombre: 'anthropic', patron: /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}/ },
  { nombre: 'openai', patron: /(?<![A-Za-z0-9])sk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/ },
  { nombre: 'google', patron: /AIza[0-9A-Za-z_-]{35}/ },
  { nombre: 'revenuecat_secreta', patron: /\bsk_[A-Za-z0-9]{24,}/ },
  { nombre: 'sentry_token', patron: /sntry[su]_[A-Za-z0-9+/=_-]{20,}/ },
  { nombre: 'posthog_personal', patron: /phx_[A-Za-z0-9]{20,}/ },
  { nombre: 'llave_privada', patron: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
];

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function rolDeJwt(payload: string): string | null {
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** SHA-256 de la llave pública y de la secreta del vector 1 de RFC 8032. */
const HUELLAS_LLAVE_PRUEBA_PLANTILLAS = new Set([
  '21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9',
  '644d50ab64864c20a12b3c4656d46b4a48f69ef7c47ecdc8415cd28316b22ef5',
]);

const esHuellaDePrueba = (bytes: Buffer) =>
  bytes.length === 32 &&
  HUELLAS_LLAVE_PRUEBA_PLANTILLAS.has(createHash('sha256').update(bytes).digest('hex'));

function contieneLlavePruebaPlantillas(contenido: string): boolean {
  for (const m of contenido.matchAll(/(?<![0-9A-Fa-f])[0-9A-Fa-f]{64}(?![0-9A-Fa-f])/g)) {
    if (esHuellaDePrueba(Buffer.from(m[0], 'hex'))) return true;
  }
  for (const m of contenido.matchAll(/(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{43}=?/g)) {
    if (esHuellaDePrueba(Buffer.from(m[0].replace(/=$/, ''), 'base64'))) return true;
  }
  for (const m of contenido.matchAll(/(?<![\d.])(?:\d{1,3}\s*,\s*){31}\d{1,3}(?![\d.])/g)) {
    const numeros = m[0].split(',').map((n) => Number(n.trim()));
    if (numeros.every((n) => n <= 255) && esHuellaDePrueba(Buffer.from(numeros))) return true;
  }
  return false;
}

/** Nombres de los patrones encontrados (nunca el secreto). */
export function buscarSecretos(contenido: string): string[] {
  const hallados = PATRONES.filter((p) => p.patron.test(contenido)).map((p) => p.nombre);
  if (contieneLlavePruebaPlantillas(contenido)) hallados.push('llave_prueba_plantillas');
  for (const m of contenido.matchAll(JWT)) {
    if (rolDeJwt(m[1] ?? '') === 'service_role') {
      hallados.push('supabase_service_role');
      break;
    }
  }
  return hallados;
}
