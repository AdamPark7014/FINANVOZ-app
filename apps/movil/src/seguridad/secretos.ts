/**
 * Patrones de secretos que nunca pueden viajar dentro de la app (regla 8, `08 §7.1`: "binario revisado con
 * `strings` en busca de secretos"). Lo público sí puede ir: la llave `anon` de Supabase, la llave de proyecto
 * de PostHog (`phc_`), el DSN de Sentry, la llave pública de RevenueCat y la llave pública de plantillas.
 * Lo usa `scripts/buscar-secretos.ts` sobre el bundle exportado (y sobre un APK descomprimido).
 */
const PATRONES: readonly { nombre: string; patron: RegExp }[] = [
  { nombre: 'anthropic', patron: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { nombre: 'openai', patron: /sk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/ },
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

/** Nombres de los patrones encontrados (nunca el secreto). */
export function buscarSecretos(contenido: string): string[] {
  const hallados = PATRONES.filter((p) => p.patron.test(contenido)).map((p) => p.nombre);
  for (const m of contenido.matchAll(JWT)) {
    if (rolDeJwt(m[1] ?? '') === 'service_role') {
      hallados.push('supabase_service_role');
      break;
    }
  }
  return hallados;
}
